<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>듀얼 헤드 설계 이유</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: #f4f4f4;
            font-family: 'Courier New', Courier, monospace;
        }

        .main-card {
            background-color: white;
            padding: 40px;
            border: 1px solid #000;
            width: 800px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .header {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 40px;
        }

        .heads-container {
            display: flex;
            justify-content: space-around;
            align-items: flex-start;
            margin-bottom: 30px;
        }

        .head-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 45%;
        }

        .head-box {
            border: 1px solid #000;
            padding: 15px;
            width: 250px;
            text-align: center;
            background-color: #fff;
            margin-bottom: 10px;
        }

        .arrow-v {
            font-size: 20px;
            margin-bottom: 10px;
        }

        .feature-list {
            font-size: 14px;
            line-height: 1.8;
            text-align: left;
            width: 100%;
            padding-left: 20px;
        }

        .footer-note {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px dashed #ccc;
            font-weight: bold;
            font-size: 15px;
        }
    </style>
</head>
<body>

    <div class="main-card">
        <div class="header">📋 듀얼 헤드 설계 이유</div>

        <div class="heads-container">
            <div class="head-group">
                <div class="head-box">
                    <strong>Head 1</strong><br>
                    Smile Detection<br>
                    (Binary)
                </div>
                <div class="arrow-v">▼</div>
                <div class="feature-list">
                    • 게임 판정용 (메인)<br>
                    • 웃음 여부 이진 분류<br>
                    • threshold 조절 가능
                </div>
            </div>

            <div class="head-group">
                <div class="head-box">
                    <strong>Head 2</strong><br>
                    Emotion Classification<br>
                    (7-class)
                </div>
                <div class="arrow-v">▼</div>
                <div class="feature-list">
                    • 보조 정보 제공<br>
                    • Neutral, Happy, Sad 등<br>
                    • 표정 다양성 학습 → 정확도 ↑
                </div>
            </div>
        </div>

        <div class="footer-note">
            Multi-task Learning으로 공유 특징 추출 강화
        </div>
    </div>

</body>
</html>