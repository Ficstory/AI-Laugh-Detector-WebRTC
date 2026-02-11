package ssafy.E207.domain.match.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import ssafy.E207.domain.match.service.ElectronSignatureCheckService;
import ssafy.E207.global.common.template.ResTemplate;
import ssafy.E207.global.jwt.UserPrincipal;

@RestController
@RequiredArgsConstructor
public class IsElectronController {
	private final ElectronSignatureCheckService electronSignatureCheckService;

	@GetMapping("/is-electron")
	public ResTemplate<Void> isElectronCheck(HttpServletRequest request) {
		boolean isElectron = electronSignatureCheckService.isElectronApp(request);
		return ResTemplate.success(HttpStatus.OK, String.valueOf(isElectron));
	}
}
