package ssafy.E207.domain.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ssafy.E207.domain.user.dto.request.ConfirmProfileImageRequest;
import ssafy.E207.domain.user.dto.request.DeleteProfileImageRequest;
import ssafy.E207.domain.user.dto.request.UpdateMarketingRequest;
import ssafy.E207.domain.user.dto.request.UpdateUserInfoRequest;
import ssafy.E207.domain.user.dto.request.UploadProfileImageRequest;
import ssafy.E207.domain.user.dto.response.ConfirmProfileImageResponse;
import ssafy.E207.domain.user.dto.response.MyInfoResponse;
import ssafy.E207.domain.user.dto.response.UploadProfileImageResponse;
import ssafy.E207.domain.user.dto.response.UserChangeResponse;
import ssafy.E207.domain.user.exception.DuplicateNicknameMessageException;
import ssafy.E207.domain.user.exception.ImageNotUploadedException;
import ssafy.E207.domain.user.service.MinioService;
import ssafy.E207.domain.user.service.UserService;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;

@RestController
@RequiredArgsConstructor
@RequestMapping("/user")
public class UserController {

    private final UserService userService;
    private final MinioService minioService;

    /**
     * [API] 닉네임 중복 체크
     *
     * GET /user/check/nickname?nickname=닉네임
     *
     * - 200: 사용 가능
     * - 400: 유효하지 않은 닉네임
     * - 409: 중복 닉네임
     */
    @GetMapping("/check/nickname")
    public ResTemplate<Void> checkNickname(@RequestParam("nickname") String nickname) {
        userService.validateNicknameFormatOrThrow(nickname);

        boolean exists = userService.isNicknameTaken(nickname);
        if (exists) {
            throw DuplicateNicknameMessageException.duplicated();
        }

        return ResTemplate.success(HttpStatus.OK, "사용 가능한 닉네임입니다.");
    }

    /**
     * [API] 내 정보 조회
     *
     * GET /user
     */
    @GetMapping
    public ResTemplate<MyInfoResponse> getMyInfo(@AuthenticationPrincipal UserPrincipal principal) {
        MyInfoResponse data = userService.getMyInfo(principal.getUserId());
        return ResTemplate.success(HttpStatus.OK, "사용자 정보 조회 성공", data);
    }

    /**
     * [API] 마케팅 수신동의 변경
     *
     * PATCH /user/change/marketing
     */
    @PatchMapping("/change/marketing")
    public ResTemplate<Void> changeMarketing(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateMarketingRequest request
    ) {
        userService.changeMarketing(principal.getUserId(), request.isMarketing());
        return ResTemplate.success(HttpStatus.OK, "마케팅 수신 동의 변경 성공");
    }

    /**
     * [API] 개인정보 수정
     *
     * PATCH /user/change
     *
     * - nickname (optional)
     * - isMarketing (optional)
     */
    @PatchMapping("/change")
    public ResTemplate<UserChangeResponse> changeUserInfo(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody(required = false) UpdateUserInfoRequest request
    ) {
        UserChangeResponse data = userService.changeUserInfo(principal.getUserId(), request);
        return ResTemplate.success(HttpStatus.OK, "정보 수정 성공", data);
    }

    /**
     * [API] 유저 프로필 이미지 업로드 Presigned URL 발급
     *
     * POST /user/upload/profileImage
     *
     * MinIO Presigned URL을 발급하여 유저 프로필 이미지 업로드를 지원한다.
     *
     * 인증 방식:
     * 1. 로그인 유저: Authorization 헤더 (Bearer accessToken)
     * 2. 회원가입 중: Request Body의 registerToken
     */
    @PostMapping("/upload/profileImage")
    public ResTemplate<UploadProfileImageResponse> uploadProfileImage(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UploadProfileImageRequest request
    ) {
        UploadProfileImageResponse data = minioService.generatePresignedUrl(principal, request);
        return ResTemplate.success(HttpStatus.OK, "유저 프로필 이미지 설정 URL 제공완료", data);
    }

    /**
     * [API] 유저 프로필 이미지 업로드 확인 및 DB 저장
     *
     * POST /user/confirm/profileImage
     *
     * 프론트엔드가 MinIO 업로드 성공 후 호출.
     * MinIO에 파일이 존재하는지 확인 후 DB에 저장한다.
     *
     * 인증 방식:
     * 1. 로그인 유저: Authorization 헤더 (Bearer accessToken)
     * 2. 회원가입 중: Request Body의 registerToken (DB 저장 안 함, 존재 확인만)
     */
    @PostMapping("/confirm/profileImage")
    public ResTemplate<ConfirmProfileImageResponse> confirmProfileImage(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ConfirmProfileImageRequest request
    ) {
        // 1. MinIO에 파일 존재 여부 확인
        boolean exists = minioService.checkObjectExists(request.objectKey());
        if (!exists) {
            throw ImageNotUploadedException.notUploaded();
        }

        // 2. 로그인 유저인 경우 DB에 저장
        if (principal != null && principal.getUserId() != null) {
            String savedUrl = userService.confirmProfileImage(principal.getUserId(), request.objectKey());
            return ResTemplate.success(HttpStatus.OK, "프로필 이미지가 저장되었습니다.", ConfirmProfileImageResponse.of(savedUrl));
        }

        // 3. 회원가입 중인 경우 (registerToken) - 파일 존재 확인만 (DB 저장은 회원가입 시 처리)
        // registerToken 검증은 MinioService에서 이미 했으므로 여기선 존재 확인만 반환
        return ResTemplate.success(HttpStatus.OK, "이미지 업로드가 확인되었습니다.", ConfirmProfileImageResponse.of(request.objectKey()));
    }

    /**
     * [API] 유저 프로필 이미지 삭제
     *
     * DELETE /user/delete/profileImage
     *
     * 업로드한 프로필 이미지를 삭제한다. (업로드 취소 또는 이미지 변경 시 사용)
     *
     * 인증 방식:
     * 1. 로그인 유저: Authorization 헤더 (Bearer accessToken)
     * 2. 회원가입 중: Request Body의 registerToken
     */
    @DeleteMapping("/delete/profileImage")
    public ResTemplate<Void> deleteProfileImage(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody DeleteProfileImageRequest request
    ) {
        // 사용자 식별자 결정
        String userIdentifier = minioService.resolveUserIdentifierForConfirm(principal, request.registerToken());

        // MinIO에서 파일 삭제
        boolean deleted = minioService.deleteObject(request.objectKey(), userIdentifier);

        if (deleted) {
            return ResTemplate.success(HttpStatus.OK, "프로필 이미지가 삭제되었습니다.");
        } else {
            return ResTemplate.success(HttpStatus.OK, "삭제할 이미지가 없거나 권한이 없습니다.");
        }
    }
}
