import rcu
import math
import motor
import sensor
import trace

# ============================================================
#  以下为「PID巡线」扩展自动注入的底层（定义区，排在最前面）
# ============================================================
# ============================================================
#  PID 巡线底层   —— 由「PID巡线」扩展自动生成
#
#  传感器安装：车头朝前，从车的左侧到右侧依次编号
#      4 光电 (E007 = 4) ： P1 P2 P3 P4     权重 [-3, -1, +1, +3]
#      循迹卡 (E007 = 7) ： 插在 P1 端口，通道 1~7
#                           权重 [-3, -2, -1, 0, +1, +2, +3]
#  error 归一化到 ±100 ： 正 = 线在车的右侧 = 需要向右修正
# ============================================================

# ---------------- 可调参数（也可用「设置PID参数」积木改） ----------------
PID_KP         = 0.80    # 比例项：绝对主力，先调它
PID_KI         = 0.00    # 积分项：消左右电机不对称，一般不用
PID_KD         = 1.60    # 微分项：抑制摆动；4 光电建议取 Kp 的 2~3 倍
PID_BASE       = 50      # 基础速度：必须大于电机死区
PID_MAX_OUT    = 60      # 差速限幅（±）
PID_DEADZONE   = 0       # 电机死区（速度单位 0~100），实测后填
PID_MIN_SUM    = 30      # 压线总和下限，低于此值（即一路都没压线）判为脱线
PID_SIGN_TH    = 3       # 误差超过此值才记录方向（抗噪）
PID_MODE_ADDR  = 7       # E007：巡线模式地址
PID_MODE_TRACE = 7       # 该地址 == 7 用循迹卡，否则用 4 光电
PID_FORCE_MODE = 0       # 0 = 按 E007 自动判断；4 = 强制 4 光电；7 = 强制循迹卡
PID_OUT_ADDR   = 6       # E006：小车冲出路口的编码值（「+冲出」用）
PID_EXIT_MAX   = 300     # 「开过路口」内循环的保险丝（次），防止路口位型一直不消失导致死循环
PID_TRACE_PORT = 1       # 循迹卡插在哪个端口（P1~P8）
PID_JUNC_EDGE  = 1       # 路口判定：最外侧连续几路压线才算。改成 2 可减少误判
PID_ANALOG_MODE = 1      # 4 光电：1 = 用模拟光值（连续、更平滑）；0 = 用数字量
PID_ANA_MIN_SPAN = 60    # 自动标定的最小黑白跨度，低于它按「没压线」处理

var_xun_xian_yan_se = 1  # 巡线颜色：黑 = 1，白 = 0
var_zhuan_wan_su_du = 40 # 「转到线」的转弯速度（固定 40）

# 「转到线」的两段判定通道： [左转先到, 左转后到, 右转先到, 右转后到]
#   4 光电 ： 左转 P1 -> P3      右转 P4 -> P2
#   循迹卡 ： 左转 ch1 -> ch4    右转 ch7 -> ch4
PID_TURN_4 = [1, 3, 4, 2]
PID_TURN_7 = [1, 4, 7, 4]

# ---------------- 4 光电模拟量：自动标定 ----------------
#  光值越黑越小。这里自动跟踪每路见过的最大/最小光值，把「白底 ~ 黑线」
#  这一段拉伸成 0 ~ 100，所以不用手填标定值，也不管量程是 1023 还是 4095。
#  想重新标定：把 _ana_init 置为 False 即可
_ana_hi   = [0, 0, 0, 0]     # 每路见过的最大光值（最白）
_ana_lo   = [0, 0, 0, 0]     # 每路见过的最小光值（最黑）
_ana_init = False

# ---------------- 传感器读取 ----------------
#  4 光电 ： 模拟量 sensor.GetLightSensor(i)      ，数字量 sensor.GetLightSensorData(i)
#  循迹卡 ： trace.GetTraceV2I2CState(P1端口, i)
#  var_xun_xian_yan_se ： 黑线 = 1，白线 = 0
def use_trace():
    # 当前是否用循迹卡（7 光电）
    m = PID_FORCE_MODE
    if m == 0:
        m = rcu.GetData(PID_MODE_ADDR)
    return m == PID_MODE_TRACE

def read_black(i):
    # 第 i 路的黑度：100 = 完全压线，0 = 完全在白底上
    if use_trace():
        return 100 if trace.GetTraceV2I2CState(PID_TRACE_PORT, i) == var_xun_xian_yan_se else 0
    if not PID_ANALOG_MODE:
        return 100 if sensor.GetLightSensorData(i) == var_xun_xian_yan_se else 0
    # ---- 4 光电：模拟量 + 自动标定 ----
    global _ana_init
    j = i - 1
    v = sensor.GetLightSensor(i)
    if not _ana_init:
        # 第一次读：用全阵列的极值当初始标定范围（车压在线上的那一瞬间正好是 黑~白）
        r1 = sensor.GetLightSensor(1)
        r2 = sensor.GetLightSensor(2)
        r3 = sensor.GetLightSensor(3)
        r4 = sensor.GetLightSensor(4)
        hi = max(r1, r2, r3, r4)
        lo = min(r1, r2, r3, r4)
        for k in range(4):
            _ana_hi[k] = hi
            _ana_lo[k] = lo
        _ana_init = True
    if v > _ana_hi[j]:
        _ana_hi[j] = v
    if v < _ana_lo[j]:
        _ana_lo[j] = v
    span = _ana_hi[j] - _ana_lo[j]
    if span < PID_ANA_MIN_SPAN:
        return 0
    b = (_ana_hi[j] - v) * 100 // span      # 越黑 -> b 越大
    if b < 0:
        b = 0
    if b > 100:
        b = 100
    if var_xun_xian_yan_se == 0:            # 巡白线：取反
        b = 100 - b
    return b

def on_line(i):
    # 第 i 路是否压线
    return read_black(i) > 50

# ---------------- 电机死区：限幅 → 补偿 → 再限幅 ----------------
def dead_zone(sp):
    sp = max(-100.0, min(100.0, sp))
    if PID_DEADZONE <= 0:
        return int(sp)
    if -0.5 < sp < 0.5:
        return 0
    sign = 1 if sp > 0 else -1
    # 线性重映射：把 [0,100] 拉伸映射到 [死区,100]，保住全量程，增益略降
    a = PID_DEADZONE + abs(sp) * (100.0 - PID_DEADZONE) / 100.0
    return sign * int(min(100.0, a))

# ---------------- 速度控制（限幅 + 写电机） ----------------
def speed_control(spl, spr):
    spl = max(-100, min(100, spl))
    spr = max(-100, min(100, spr))
    motor.SetMotor(1, spl)
    motor.SetMotor(2, spr)

# ---------------- PID 巡线核心：跑一个周期 ----------------
_pid_integral  = 0.0
_pid_last_err  = 0.0
_pid_last_sign = 0
_pid_was_lost  = False
_pid_first     = True

def pid_reset():
    global _pid_integral, _pid_last_err, _pid_last_sign, _pid_was_lost, _pid_first
    _pid_integral  = 0.0
    _pid_last_err  = 0.0
    _pid_last_sign = 0
    _pid_was_lost  = False
    _pid_first     = True

def xunxian_once(speed=None):
    # 巡线一次：读一次传感器 → 算一次 PID → 输出一次速度
    global _pid_integral, _pid_last_err, _pid_last_sign, _pid_was_lost, _pid_first

    if speed is None:
        speed = PID_BASE

    if use_trace():
        n = 7
        w = [-3, -2, -1, 0, 1, 2, 3]
    else:
        n = 4
        w = [-3, -1, 1, 3]

    sum_v = 0.0
    sum_w = 0.0
    for i in range(n):
        v = read_black(i + 1)
        sum_v += v
        sum_w += v * w[i]

    if sum_v < PID_MIN_SUM:
        # ---- 脱线：沿最后一次的方向给满舵去找线 ----
        if _pid_last_sign > 0:
            error = 100.0
        elif _pid_last_sign < 0:
            error = -100.0
        else:
            error = 0.0
        now_lost = True
    else:
        # ---- 压线：加权平均求连续偏差 ----
        error = sum_w / sum_v * 33.0
        now_lost = False
        if error > PID_SIGN_TH:
            _pid_last_sign = 1
        elif error < -PID_SIGN_TH:
            _pid_last_sign = -1

    if not now_lost:
        # 脱线期间冻结积分，防止积分爆掉
        _pid_integral = max(-1000.0, min(1000.0, _pid_integral + error))

    if _pid_first or (_pid_was_lost and not now_lost):
        # 第一次运行 / 刚重新入线：跳过这一次 D
        # 否则 error 从 0 突跳到几十，D 项会被瞬间拉到满舵，把车猛地拽一下
        d_term = 0.0
    else:
        d_term = PID_KD * (error - _pid_last_err)
    _pid_first = False

    out = PID_KP * error + PID_KI * _pid_integral + d_term
    out = max(-PID_MAX_OUT, min(PID_MAX_OUT, out))

    speed_control(dead_zone(speed + out), dead_zone(speed - out))

    _pid_last_err = error
    _pid_was_lost = now_lost
    return error

# ---------------- 路口判断 ----------------
#   基础路口只有三种： 1 左路口   2 右路口   3 T路口
#   （积木里的 4/5/6 是同三种 + 冲出，在 xunxian_stop_junction 里换算回 1/2/3）
#   判定依据是「最外侧那几路是否压线」：
#       左路口 -> 最左侧压线、最右侧不压线（有支线往左分出）
#       右路口 -> 最右侧压线、最左侧不压线
#       T路口  -> 两侧同时压线（横线穿过）
#   PID_JUNC_EDGE 控制「最外侧连续几路压线才算」，默认 1（最灵敏）
def junction_detect(jtype):
    n = 7 if use_trace() else 4
    k = PID_JUNC_EDGE
    if k < 1:
        k = 1
    if k > n // 2:
        k = n // 2
    left = True
    right = True
    for i in range(k):
        if not on_line(i + 1):
            left = False        # 最左边第 i+1 路没压线
        if not on_line(n - i):
            right = False       # 最右边第 i+1 路没压线
    if jtype == 1:
        return left and not right
    if jtype == 2:
        return right and not left
    if jtype == 3:
        return left and right
    return False

# ---------------- 巡线封装 ----------------
def run_straight_bmz(speed, bmp):
    # 纯直行 bmp 个编码值（不巡线）
    #   bmp > 0 -> 笔直前进     bmp < 0 -> 笔直倒退     bmp = 0 -> 不动
    # 用 dead_zone() 是为了和巡线时的等效基础速度一致
    if bmp == 0:
        return
    sign = 1 if bmp > 0 else -1
    v = sign * dead_zone(abs(speed))
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while math.fabs(motor.GetMotorCode(1)) < math.fabs(bmp):
        speed_control(v, v)

def xunxian_stop_junction(speed, jtype, adjust=0):
    # 巡线，遇到 jtype 路口后停车
    # jtype : 1 左路口 / 2 右路口 / 3 T路口
    #         4 左路口+冲出 / 5 右路口+冲出 / 6 T路口+冲出
    # adjust: 调整的编码值（默认 0，可正可负）
    #         正数 -> 过路口后继续笔直前进；负数 -> 笔直倒退
    #         带冲出   -> 冲出距离 = E006 + adjust
    #         不带冲出 -> 直接走 adjust 个编码值（0 即「遇到路口立刻停」）
    pid_reset()
    out_flag = 0
    if jtype > 3:
        out_flag = 1
        jtype = jtype - 3
    while True:
        xunxian_once(speed)
        if junction_detect(jtype):
            guard = 0
            while junction_detect(jtype) and guard < PID_EXIT_MAX:
                # 先开过路口区域，避免同一个路口被重复计数
                # guard 是保险丝：路口位型一直不消失时，最多再跑 PID_EXIT_MAX 次就放行
                xunxian_once(speed)
                guard = guard + 1
            if out_flag == 1:
                run_straight_bmz(speed, rcu.GetData(PID_OUT_ADDR) + adjust)
            else:
                run_straight_bmz(speed, adjust)
            break
    speed_control(0, 0)
    rcu.SetInBeep(1)          # 停车提示音
    rcu.SetWaitForTime(0.1)
    rcu.SetInBeep(0)
    rcu.SetWaitForTime(0.1)

def xunxian_distance(speed, bmp):
    # 巡线走 bmp 个编码值
    pid_reset()
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while math.fabs(motor.GetMotorCode(1)) < bmp:
        xunxian_once(speed)
    motor.SetMotorStop(1)
    motor.SetMotorStop(2)
    rcu.SetWaitForTime(0.1)

# ---------------- 转向 / 走直线 ----------------
def turn_ch(k):
    # k: 0 左转先到 / 1 左转后到 / 2 右转先到 / 3 右转后到
    if use_trace():
        return PID_TURN_7[k]
    return PID_TURN_4[k]

def turn_left_line():
    # 左轮后退 + 右轮前进 -> 车身左转；线从最左侧扫入，扫到接近中间就停
    speed_control(dead_zone(var_zhuan_wan_su_du * (-1)), dead_zone(var_zhuan_wan_su_du))
    while not on_line(turn_ch(0)):
        pass
    while not on_line(turn_ch(1)):
        pass
    speed_control(0, 0)
    rcu.SetWaitForTime(0.1)

def turn_right_line():
    speed_control(dead_zone(var_zhuan_wan_su_du), dead_zone(var_zhuan_wan_su_du * (-1)))
    while not on_line(turn_ch(2)):
        pass
    while not on_line(turn_ch(3)):
        pass
    speed_control(0, 0)
    rcu.SetWaitForTime(0.1)

def go_straight(sp, bmp):
    # 走直线：用编码器差分做同步，走满 bmp 个编码值
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while math.fabs(motor.GetMotorCode(1)) < bmp:
        left = math.fabs(motor.GetMotorCode(1))
        right = math.fabs(motor.GetMotorCode(2))
        diff = left - right
        left_speed = sp - diff * 0.3
        right_speed = sp + diff * 0.3
        left_speed = max(0, min(sp * 1.2, left_speed))
        right_speed = max(0, min(sp * 1.2, right_speed))
        speed_control(left_speed, right_speed)
    motor.SetMotorStop(1)
    motor.SetMotorStop(2)
    rcu.SetWaitForTime(0.1)

def turn_bmz(spl, spr, bmp):
    # 左右轮以不同速度转，任意一轮走满 bmp 个编码值就停
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while not (((math.fabs(motor.GetMotorCode(1))) > bmp) or ((math.fabs(motor.GetMotorCode(2))) > bmp)):
        speed_control(spl, spr)
    motor.SetMotorStop(1)
    motor.SetMotorStop(2)
    rcu.SetWaitForTime(0.1)

# ---------------- 不用积木也能用的几个提示 ----------------
# 编码值清空 :  motor.SetMotorCode(1) ; motor.SetMotorCode(2)
# 蜂鸣器     :  rcu.SetInBeep(1) ; rcu.SetWaitForTime(0.1) ; rcu.SetInBeep(0)
# 读地址     :  if rcu.GetData(7) == 7:      # E007 = 7 表示用循迹卡

# ============================================================
#  主程序（下面这段就是你在图形界面里拖积木拖出来的部分）
# ============================================================

# ---- 初始化 巡线颜色 [黑线] ----
#      黑线 -> 判断压线用  == 1 ；白线 ->  == 0
var_xun_xian_yan_se = 1

# ---- 设置PID Kp [0.8] Ki [0] Kd [1.6] 基础速度 [50] ----
PID_KP = 0.8
PID_KI = 0
PID_KD = 1.6
PID_BASE = 50

# ---- 巡线遇路口停 速度 [50] 路口类型 [左路口] 调整编码值 [0] ----
#      调整编码值 = 0 -> 遇到左路口立刻停（停车时会响一声提示音）
xunxian_stop_junction(50, 1, 0)

# ---- 左 转到线（转弯速度固定 40，在底层 var_zhuan_wan_su_du 里）----
turn_left_line()

# ---- 巡线遇路口停 速度 [50] 路口类型 [T路口+冲出] 调整编码值 [0] ----
#      「+冲出」= 巡线到该路口后不停车，改为纯直行冲出，走 E006 + 调整编码值
xunxian_stop_junction(50, 6, 0)

# ---- 巡线遇路口停 速度 [50] 路口类型 [右路口] 调整编码值 [150] ----
#      正数 -> 过右路口后继续笔直前进 150 个编码值才停
xunxian_stop_junction(50, 2, 150)

# ---- 巡线遇路口停 速度 [50] 路口类型 [左路口] 调整编码值 [-80] ----
#      负数 -> 遇到左路口后笔直倒退 80 个编码值才停
xunxian_stop_junction(50, 1, -80)

# ---- 巡线距离 速度 [50] 编码值 [1500] ----
xunxian_distance(50, 1500)

# ---- 走距离 速度 [50] 编码值 [1000] ----
go_straight(50, 1000)

# ---- 转编码值 左轮速度 [50] 右轮速度 [-50] 编码值 [500] ----
turn_bmz(50, -50, 500)
