# 산길 트레킹 휴대폰 검증 기준

상태: 실측 전. 아래는 합격 조건이며 실제 합격 결과가 아니다.

## 설치 안전
- 테스트 APK 패키지는 `kr.sangil.myhiking.preview`이다. 운영 패키지 `kr.sangil.myhiking`의 업데이트가 아니다. 운영 앱을 삭제하거나 데이터를 초기화하지 않는다.
- GitHub Actions 성공 실행의 signed preview APK만 후보로 사용한다. debug APK는 사용하지 않는다.
- 기존 preview 설치가 있다면 APK 서명 SHA-256 및 versionCode를 비교한다. 불일치 또는 확인 불가 시 설치 중단. 운영용 서명과도 별도로 비교해야 한다.
- 확인 명령(ADB 연결된 테스트 PC): `adb shell pm list packages sangil`, `adb shell dumpsys package kr.sangil.myhiking.preview`. APK는 `apksigner verify --verbose --print-certs app-release.apk`, `aapt dump badging app-release.apk`로 검사. 기존 APK 추출은 `adb shell pm path kr.sangil.myhiking.preview` 결과를 확인한 후 `adb pull`로 별도 복사해 서명을 검사한다.
- APK 또는 AAB에 운영 앱 호환이 입증되었다고 표시하지 않는다. preview AAB는 Play 제출 금지.

## 실측 시나리오
| ID | 방법 | 합격 조건 |
|---|---|---|
| F01 | 동일 휴대폰으로 트랭글과 산길을 동시에 시작/종료, 약 3.1km 걷기 | 거리 차이 5% 이내를 목표로 하고, 실제 거리·시간·경로 원본을 비교. 두 앱의 거리 차이만으로 정확성 확정하지 않음 |
| F02 | 화면 끄기 10분, 다른 앱 사용 5분 후 복귀 | GPS 백업 복구, 경로 누락/비정상 직선 여부 확인 |
| F03 | 수동 정지 후 재개, 자동 정지 후 재개 | 휴식시간 및 거리 정상, 정지 구간 임의 연결 없음 |
| F04 | 운동 중 화면 회전 및 전체화면 전환 | 지도와 운동 기록 유지, 버튼 겹침 없음 |
| F05 | 1km 및 2km 통과, 앱 복귀 | 음성 중복 없음, 한국어 실제 재생 확인 |
| F06 | 걸음수 권한 허용/거부, 센서 확인 | 미측정은 0보로 위장하지 않음, 운동별 집계 확인 |
| F07 | 운동 종료, 앱 재실행 | 기록 중복 없이 거리·시간·걸음수 유지 |
| F08 | GPX 열기/내보내기, PNG 공유 | 경로 단절 유지, 카카오톡 공유 실제 확인 |

각 검증에서 휴대폰 모델, Android 버전, APK 버전, 권한, 화면 상태, 시작/종료 시각, 거리 및 오류를 기록한다. 실제 실측 자료와 서명 비교 결과가 없으면 운영 앱 업데이트와 출시 승인을 보류한다.
