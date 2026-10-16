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
#      4 光电 (E007 = 4) ： P1 P2 P3 P4
#           巡线  -> 差值法：误差 = 光值(P3) - 光值(P2)，直接用原始模拟光值
#           压线  -> sensor.GetLightSensorData(i) == var_xun_xian_yan_se
#      循迹卡 (E007 = 7) ： 插在 P1 端口，通道 1~7
#           巡线  -> 重心法：权重 [-3,-2,-1,0,+1,+2,+3]，error 归一化到 ±100
#           压线  -> trace.GetTraceV2I2CState(P1端口, i) == var_xun_xian_yan_se
#
#  PID 参数（Kp / Ki / Kd）默认写死在下面的四组参数表里，
#  运行时按 E005（电机类型）× E007（阵列类型）自动选用其中一组；
#  如果程序里用了「设置PID Kp Ki Kd」积木，就改用积木里填的那一组值。
# ============================================================

# ------- 地址定义 -------
PID_MOTOR_ADDR = 5       # E005：马达类型
PID_MOTOR_WR   = 1       #   1 = 白红电机
PID_MOTOR_GR   = 2       #   2 = 灰红电机
PID_MODE_ADDR  = 7       # E007：巡线阵列类型
PID_MODE_4     = 4       #   4 = 4 光电巡线
PID_MODE_TRACE = 7       #   7 = 循迹卡巡线
PID_FORCE_MODE = 0       # 0 = 按 E007 自动判断；4 = 强制 4 光电；7 = 强制循迹卡
PID_OUT_ADDR   = 6       # E006：小车冲出路口的编码值（「+冲出」用）

# ------- PID 参数表：四组，下标 = 电机序号 * 2 + 阵列序号 -------
#     [0] 白红 + 4 光电      [1] 白红 + 循迹卡
#     [2] 灰红 + 4 光电      [3] 灰红 + 循迹卡
#
#  4 光电走「差值法」：误差 = 光值(P3) - 光值(P2)，直接用原始模拟光值，
#      量纲是几百~几千，所以 Kp / Kd 很小（0.0x 级）
#      线在左（P2 更黑）-> 光值(P2) 更小 -> 误差为正
#      修正量 = 误差*Kp + 积分*Ki + (误差-上次误差)*Kd
#      左轮 = 速度 - 修正量      右轮 = 速度 + 修正量
#  循迹卡走「重心法」：误差已归一化到 ±100，量纲小，所以 Kp / Kd 是 1 附近
#      实测：白红电机 Kp=0.8 / Ki=0 / Kd=1.6 刚好；
#            灰红电机同样参数摇摆明显 -> Kp 减半，Kd 不变（阻尼比更高，正好压摇摆）
#
#  这两组量纲完全不同，所以必须分开存；两种电机增益不同，再分一层。
PID_KP_TAB = [0.015, 0.80, 0.010, 0.40]
PID_KI_TAB = [0.000, 0.00, 0.000, 0.00]
PID_KD_TAB = [0.030, 1.60, 0.030, 1.60]

# ------- 手动覆盖开关：由积木「设置PID Kp Ki Kd」置 1 -------
#   积木没用 -> PID_USE_SET 保持 0 -> 按 E005 × E007 用上面四组默认表
#   积木用了 -> PID_USE_SET = 1    -> 直接用积木里填的 Kp / Ki / Kd（四组表暂时失效）
#   想回到默认表：把那个积木删掉即可
PID_USE_SET = 0
PID_KP_SET  = 0.0
PID_KI_SET  = 0.0
PID_KD_SET  = 0.0

# ------- 当前生效值（由 apply_param() 按 E005 + E007 装载）-------
PID_KP   = PID_KP_TAB[0]
PID_KI   = PID_KI_TAB[0]
PID_KD   = PID_KD_TAB[0]
PID_BASE = 50            # 巡线基础速度缺省值（积木里传了速度就以积木为准）

PID_DEADZONE   = 0       # 电机死区（速度单位 0~100），实测后填
PID_MAX_OUT    = 60      # 差速限幅（±）
PID_MIN_SUM    = 30      # 黑度总和下限，低于此值（即一路都没压线）判为脱线
PID_SIGN_TH    = 3       # 误差超过此值才记录方向（抗噪）
PID_I4_LIMIT   = 20000   # 4 光电差值法的积分限幅（光值单位），防止积分饱和
PID_EXIT_MAX   = 300     # 「开过路口」内循环的保险丝（次），防止路口位型一直不消失导致死循环
PID_TRACE_PORT = 1       # 循迹卡插在哪个端口（P1~P8）
PID_JUNC_EDGE  = 1       # 路口判定：最外侧连续几路压线才算。改成 2 可减少误判

def motor_idx():
    # E005：1 = 白红 -> 0 ；2 = 灰红 -> 1 （异常值按白红处理）
    if rcu.GetData(PID_MOTOR_ADDR) == PID_MOTOR_GR:
        return 1
    return 0

def mode_idx():
    # E007：7 = 循迹卡 -> 1 ；4（或其它）= 4 光电 -> 0
    m = PID_FORCE_MODE
    if m == 0:
        m = rcu.GetData(PID_MODE_ADDR)
    return 1 if m == PID_MODE_TRACE else 0

def param_idx():
    # 四组参数的下标 = 电机序号 * 2 + 阵列序号
    return motor_idx() * 2 + mode_idx()

def apply_param():
    # 按 E005 + E007 把对应那一组装载到「当前生效值」上
    # 每个巡线周期调用一次，所以中途换电机 / 换阵列也能立刻生效
    # 如果积木「设置PID Kp Ki Kd」用过（PID_USE_SET = 1），就直接用积木里填的值
    global PID_KP, PID_KI, PID_KD
    if PID_USE_SET == 1:
        PID_KP = PID_KP_SET
        PID_KI = PID_KI_SET
        PID_KD = PID_KD_SET
        return
    i = param_idx()
    PID_KP = PID_KP_TAB[i]
    PID_KI = PID_KI_TAB[i]
    PID_KD = PID_KD_TAB[i]

var_xun_xian_yan_se = 1  # 巡线颜色：黑 = 1，白 = 0
var_zhuan_wan_su_du = 40 # 「转到线」的转弯速度（固定 40）

# 「转到线」的两段判定通道： [左转先到, 左转后到, 右转先到, 右转后到]
#   4 光电 ： 左转 P1 -> P3      右转 P4 -> P2
#   循迹卡 ： 左转 ch1 -> ch4    右转 ch7 -> ch4
PID_TURN_4 = [1, 3, 4, 2]
PID_TURN_7 = [1, 4, 7, 4]

# ---------------- 传感器读取 ----------------
#  4 光电 ： 巡线用模拟量 sensor.GetLightSensor(i)；压线判断用数字量 GetLightSensorData(i)
#  循迹卡 ： trace.GetTraceV2I2CState(P1端口, i)
#  var_xun_xian_yan_se ： 黑线 = 1，白线 = 0
def use_trace():
    # 当前是否用循迹卡（7 光电）：E007 == 7
    return mode_idx() == 1

def on_line(i):
    # 第 i 路是否压线
    if use_trace():
        return trace.GetTraceV2I2CState(PID_TRACE_PORT, i) == var_xun_xian_yan_se
    return sensor.GetLightSensorData(i) == var_xun_xian_yan_se

def read_black(i):
    # 第 i 路的黑度：100 = 压线，0 = 没压线（只给循迹卡的重心法用）
    return 100 if on_line(i) else 0

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

# ---------------- 4 光电：差值巡线（P3 - P2），带 P / I / D 三项 ----------------
_cz_last_err = 0.0
_cz_integral = 0.0
_cz_first    = True

def chai_zhi_reset():
    global _cz_last_err, _cz_integral, _cz_first
    _cz_last_err = 0.0
    _cz_integral = 0.0
    _cz_first    = True

def chai_zhi_xun_xian_once(su_du):
    # 4 光电差值巡线，跑一个周期
    global _cz_last_err, _cz_integral, _cz_first
    apply_param()                # 按 E005 + E007 装载当前生效的 Kp / Ki / Kd
    var_wu_cha_zhi = sensor.GetLightSensor(3) - sensor.GetLightSensor(2)

    # ---- I 项：累加 + 限幅（防止积分饱和）----
    _cz_integral = _cz_integral + var_wu_cha_zhi
    if _cz_integral > PID_I4_LIMIT:
        _cz_integral = PID_I4_LIMIT
    elif _cz_integral < -PID_I4_LIMIT:
        _cz_integral = -PID_I4_LIMIT

    # ---- D 项：误差的变化率；第一次调用跳过，避免开机瞬间被猛拽一下 ----
    if _cz_first:
        var_wei_fen = 0.0
        _cz_first = False
    else:
        var_wei_fen = var_wu_cha_zhi - _cz_last_err

    var_zhuan_dong_su_du = (var_wu_cha_zhi * PID_KP
                            + _cz_integral * PID_KI
                            + var_wei_fen * PID_KD)

    if var_xun_xian_yan_se == 1:
        speed_control(dead_zone(su_du - var_zhuan_dong_su_du),
                      dead_zone(su_du + var_zhuan_dong_su_du))
    else:
        speed_control(dead_zone(su_du + var_zhuan_dong_su_du),
                      dead_zone(su_du - var_zhuan_dong_su_du))

    _cz_last_err = var_wu_cha_zhi
    return var_zhuan_dong_su_du

# ---------------- 循迹卡：重心法巡线核心：跑一个周期 ----------------
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
    chai_zhi_reset()

def xunxian_once(speed=None):
    # 巡线一次：读一次传感器 → 算一次 PID → 输出一次速度
    #   4 光电 -> 差值法（chai_zhi_xun_xian_once）
    #   循迹卡 -> 重心法（下面这段）
    global _pid_integral, _pid_last_err, _pid_last_sign, _pid_was_lost, _pid_first

    apply_param()                # 按 E005 + E007 装载当前生效的 Kp / Ki / Kd

    if speed is None:
        speed = PID_BASE

    if not use_trace():
        return chai_zhi_xun_xian_once(speed)

    n = 7
    w = [-3, -2, -1, 0, 1, 2, 3]

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
# 读电机类型 :  if rcu.GetData(5) == 2:      # E005 = 2 表示灰红电机
# 读阵列类型 :  if rcu.GetData(7) == 7:      # E007 = 7 表示用循迹卡
# 改 PID 参数 :  直接改上面的 PID_KP_TAB / PID_KI_TAB / PID_KD_TAB 四组表即可
#                下标 = 电机序号*2 + 阵列序号
#                [0]白红+4光电 [1]白红+循迹卡 [2]灰红+4光电 [3]灰红+循迹卡
# 手动覆盖   :  PID_KP_SET = 0.9 ; PID_KI_SET = 0 ; PID_KD_SET = 0.5 ; PID_USE_SET = 1
#                （这就是「设置PID Kp Ki Kd」积木生成的四行；四组表会被跳过）

# ============================================================
#  主程序（下面这段就是你在图形界面里拖积木拖出来的部分）
# ============================================================

# ---- 初始化 巡线颜色 [黑线] ----
#      黑线 -> 压线判断用  == 1 ；白线 ->  == 0
var_xun_xian_yan_se = 1

# ---- 设置PID 的积木（可选，不用也没关系）----
#      不用这个积木 -> 按 E005（马达类型）× E007（阵列类型）自动用底层四组默认表
#      用了这个积木 -> 直接用这里填的 Kp / Ki / Kd，四组默认表被跳过
#      想回到默认表，把这个积木删掉就行
#      建议放在程序最前面（它只影响后面拖的积木）
PID_KP_SET = 0.9
PID_KI_SET = 0
PID_KD_SET = 0.5
PID_USE_SET = 1

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
