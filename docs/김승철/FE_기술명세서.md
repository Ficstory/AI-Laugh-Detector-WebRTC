1. 프레임워크
	대상 : React
	이유 : 생태계가 크고 참고자료가 풍부함, 자유도가 높고 다수의 기업에서 사용 경험을 요구.

2. 빌드 도구
	대상 : Vite
	이유 : 로그인 이후 사용하는 서비스 중심의 시스템과 빠른 개발에 적합. 백엔드 서비스도 따로 존재..

3. 상태관리
	대상 : Zustend
	이유 : 문법이 간결, 개발 기간이 단기간이라 빠른 작업에 용이하기 때문에 선택.

4. 스타일링
	대상 : Tailwind CSS
	이유 : 스타일 충돌 방지 및 많은 기업에서 현재 trend로 사용하고 있는 CSS.

5. HTTP 클라이언트
	대상 : Axios + Tanstack Query
	이유 : 안정적이고 관련 정보가 가장 많음.

6. 라우팅
	대상 : React Router
	이유 : React에서 제공하는 전용 라우터를 사용.

7. Form 관리
	대상 : React Hook Form
	이유 : React에서 제공하는 전용 폼을 사용.
	
8. 실시간 통신 / 시그널링
	대상 : WebSocket, Socket I.O
	이유 : WebRTC와 같이 함께 사용할 표준이자 좋은 조합.

9. 코드 품질
	대상 : Prettier
	이유 : 협업을 위한 code convention

10. 배포
	대상 : Doker Compose
	이유 : 백엔드 그리고 AI팀과 같은 환경을 맞추어 오류를 방지하기 위함.
	
11. 브라우저 지원
	대상 : 
	이유 : 

12. 성능 목표
	- WebRTC와 WebSocket을 사용한 실시간 화상채팅 기능을 구현
	- 웃음 감지 AI 모델이 FrontEnd와 잘 연동되도록 구현