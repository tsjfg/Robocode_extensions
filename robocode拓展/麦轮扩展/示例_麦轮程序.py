# 等效示例: 图形化程序生成的 Python 代码长这样
# 对应积木: 初始化 -> 灰度反色 -> 巡线 -> 运动到灰度 -> 转向 -> 侧移 -> 停车
import rcu
import math
import time

mc_maxspeed = 100
mc_wheel_r = 3.0
mc_enc_lines = 360
mc_turn_c = 0.222
mc_min_spd = 30
mc_wheel_dir = [1, 1, 1, 1]
mc_inv = 0
mc_laste = 0
mc_ppc = 19.1

# ---- 以下函数由"初始化麦轮底盘"积木注入(源码见 index.js) ----
# mc_setup / mc_apply / mc_set4 / mc_stop / mc_set_max / mc_calib
# mc_dir_fix / mc_set_inv / mc_angle / mc_sensor / mc_until
# mc_dist_cm / mc_move / mc_move_kt / mc_turn / mc_line_pd / mc_line / mc_line_until

def task1():
    mc_setup()                              # 初始化麦轮底盘
    mc_set_inv(0)                           # 灰度反色 关
    mc_line(50, 8, 3, 1.0)                  # 巡线 速度50 kp8 kd3 持续1秒
    mc_line_until(4, 50, 8, 3, 3.0)         # 巡线到传感器 S4 超时3秒
    mc_until(2, 50, 4, 3.0)                 # 直行到灰度 S4 超时3秒
    mc_turn(50, 90)                         # 转向 90度 (编码器闭环)
    mc_move(1, 50, 10)                      # 侧移 10cm
    mc_move_kt(50, 20, 10)                  # 斜移 20cm 旋转分量 10
    mc_angle(70, 30)                      # 按角度移动 70速度 30度(官方公式)
    mc_stop()                               # 停车

task1()
