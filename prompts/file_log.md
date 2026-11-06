[冷房ボタン](../captures/reibo_on.log)
[除湿ボタン](../captures/jyoshitsu_on.log)
[暖房ボタン](../captures/danbo_on.log)
[停止ボタン](../captures/stop.log)
[温度上昇ボタン(トグル？その1)](../captures/temp_up_to_1.log)
[温度上昇ボタン(トグル？その2)](../captures/temp_up_to_2.log)
[温度下降ボタン(トグル？その1)](../captures/temp_down_to_1.log)
[温度下降ボタン(トグル？その2)](../captures/temp_down_to_2.log)
[自動ボタン](../captures/auto.log)
[送風ボタン](../captures/send_wind.log)
[スイングボタン](../captures/swing.log)
[風向ボタン](../captures/wind_direction.log)
[風量ボタン](../captures/wind_amount.log)


入タイマー(../captures/ontimer/*.log), 切タイマー, [とりけし](../captures/dont.log)ボタンに関しては、Webアプリ側でキューを作って冷房・除湿・暖房・停止ボタンの信号を送信することで解決し、とりけしボタンはキューの削除という形にしたい。