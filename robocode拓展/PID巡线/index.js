const { ArgumentType, BlockType, ScratchBlocks, formatMessage, send } =
    window.Scratch;

/**
 * PID巡线 扩展
 * 结构完全参照「舵机狗」扩展：
 *   - _generateCode() 返回 { Python: { opcode: fn } }
 *   - 用 ScratchBlocks.Python.Import("模块") 引入 rcu / math / motor / sensor / trace
 *   - 用 ScratchBlocks.Python.functionNames_[名字] = "def ..." 注入底层函数（字典，重复注入只保留一份）
 *   - 用 ScratchBlocks.Python.valueToCode(block, "参数", 16) 取输入
 *   - 用 block.getFieldValue("下拉名") 取下拉菜单
 */
class PIDXunXian0001E6E7M6Block {
    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
    }

    static _generateCode() {
        /**
         * 巡线底层：整段注入到生成代码的定义区。
         * 只要有一个积木被使用，这份底层就会被写进程序里（字典去重，不会重复）。
         */
        const CORE = `
# ============================================================
#  PID 巡线底层   —— 由「PID巡线」扩展自动生成
#
#  传感器安装：车头朝前，从车的左侧到右侧依次编号
#      4 光电 (E007 = 4) ： P1 P2 P3 P4
#           巡线  -> 差值法：误差 = 光值(P3) - 光值(P2)，直接用原始模拟光值
#           压线  -> sensor.GetLightSensorData(i) == line_color()
#      循迹卡 (E007 = 7) ： 插在 P1 端口，通道 1~7
#           巡线  -> 重心法：权重 [-3,-2,-1,0,+1,+2,+3]，error 归一化到 ±100
#           压线  -> trace.GetTraceV2I2CState(P1端口, i) == trace_level()
#
#  巡线颜色由积木「初始化 巡线颜色」调用 set_line_color(0/1) 设定：
#      0 = 白线，1 = 黑线。底层统一用 line_color() 读取。
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
#      黑线： 左轮 = 速度 - 修正量    右轮 = 速度 + 修正量
#      白线： 左右对调（白线压线处光值变高，误差符号整体反相）
#  循迹卡走「重心法」：误差已归一化到 ±100，量纲小，所以 Kp / Kd 是 1 附近
#      实测：白红电机 Kp=0.8 / Ki=0 / Kd=1.6 刚好；
#            灰红电机同样参数摇摆明显 -> Kp 减半，Kd 不变（阻尼比更高，正好压摇摆）
#
#  这两组量纲完全不同，所以必须分开存；两种电机增益不同，再分一层。
PID_KP_TAB = [0.015, 0.80, 0.010, 0.40]
PID_KI_TAB = [0.000, 0.00, 0.000, 0.00]
PID_KD_TAB = [0.030, 1.60, 0.030, 1.60]

# ------- 手动覆盖参数：由积木「设置PID Kp Ki Kd」写入 -------
#   积木没用 -> [0] 保持 0 -> 按 E005 × E007 用上面四组默认表
#   积木用了 -> [0] = 1    -> 直接用积木里填的 Kp / Ki / Kd（四组表暂时失效）
#   想回到默认表：把那个积木删掉即可
#
#  ★ 为什么用 list 存、还要配一个 set 函数：
#    积木生成的赋值语句，落点是「主程序区」。如果主程序被平台包进函数里，
#    那么 PID_KP_SET = 0.8 只是个局部变量，底层函数读到的还是全局的 0.0
#    —— 现象就是「积木填了参数，实际一点没生效」。
#    list 是可变对象，在函数里改它的元素不需要 global 声明，一定写到同一份数据上。
#    所以积木改成调用 set_pid_override()，由它去改 list，作用域问题彻底消失。
PID_SET_CFG = [0, 0.0, 0.0, 0.0]   # [0]=是否启用  [1]=Kp  [2]=Ki  [3]=Kd

def set_pid_override(kp, ki, kd):
    # 「设置PID Kp Ki Kd」积木调用这个函数
    # float() 是保险：万一生成器把输入当字符串传进来，也不会在后面乘法时报错
    PID_SET_CFG[0] = 1
    PID_SET_CFG[1] = float(kp)
    PID_SET_CFG[2] = float(ki)
    PID_SET_CFG[3] = float(kd)

def clear_pid_override():
    # 想回到四组默认表：程序里调用一次这个函数即可（或删掉设置积木）
    PID_SET_CFG[0] = 0

# ------- 当前生效值：Kp / Ki / Kd 由 apply_param() 按 E005 + E007 装载 -------
PID_KP   = PID_KP_TAB[0]
PID_KI   = PID_KI_TAB[0]
PID_KD   = PID_KD_TAB[0]
PID_BASE = 50            # 巡线基础速度缺省值（积木里传了速度就以积木为准，apply_param 不改它）

PID_DEADZONE   = 0       # 电机死区（速度单位 0~100），实测后填
PID_MAX_OUT    = 60      # 差速限幅（±）
PID_MIN_SUM    = 30      # 黑度总和下限，低于此值（即一路都没压线）判为脱线
PID_SIGN_TH    = 3       # 误差超过此值才记录方向（抗噪）
PID_I4_LIMIT   = 20000   # 4 光电差值法的积分限幅（光值单位），防止积分饱和
PID_TURN_MAX   = 10000   # 「转到线」等线的保险丝（次），防止找不到线时原地转到天荒地老
PID_TRACE_PORT = 1       # 循迹卡插在哪个端口（P1~P8）
PID_JUNC_EDGE  = 1       # 路口判定：最外侧连续几路压线才算。改成 2 可减少误判
PID_JUNC_HOLD  = 3       # 路口判定：连续这么多周期都命中才算真路口（防虚线误判）

# 「走距离」的停滞保护：编码值连续这么久没有增长，就认为车已经走不动了
#   单位是秒。填 0 表示关闭这个保护（回到原来「一直等下去」的行为）。
#   注意它看的是「有没有进展」，不是「总共花了多久」——
#   同样的编码值，速度调慢时耗时会成倍变长，按总时间卡死会把正常的长距离截断在半路。
PID_GO_TIMEOUT = 3.0

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
    # 如果积木「设置PID Kp Ki Kd」用过（PID_SET_CFG[0] = 1），就直接用积木里填的值
    global PID_KP, PID_KI, PID_KD
    if PID_SET_CFG[0] == 1:
        PID_KP = PID_SET_CFG[1]
        PID_KI = PID_SET_CFG[2]
        PID_KD = PID_SET_CFG[3]
        return
    i = param_idx()
    PID_KP = PID_KP_TAB[i]
    PID_KI = PID_KI_TAB[i]
    PID_KD = PID_KD_TAB[i]

# ---------------- 巡线颜色：0 = 白线，1 = 黑线 ----------------
#  ★ 用 list 存，不用普通变量，原因和上面的 PID_SET_CFG 一样：
#    积木生成的 var_xun_xian_yan_se = 0 如果落在函数体内，就只是局部变量，
#    底层所有函数读到的仍然是全局的 1 —— 于是「积木选了白线，车却按黑线跑」。
#    这就是四光电和循迹卡都巡不了白线的直接原因。
#    现在积木改成调用 set_line_color(0/1)，由它去改 list 元素，
#    不管生成在模块级还是函数内，都一定写到同一份数据上。
#  ★ 注意：底层不再有 var_xun_xian_yan_se 这个变量，改它不会有任何效果。
PID_CFG = [1]            # [0] = 巡线颜色

def line_color():
    # 0 = 白线，1 = 黑线
    return PID_CFG[0]

def set_line_color(v):
    # 「初始化 巡线颜色」积木调用这个函数
    # 同时接受 0/1 和 "0"/"1"，防止生成器把下拉值当字符串传进来
    if v == 0 or v == "0":
        PID_CFG[0] = 0
    else:
        PID_CFG[0] = 1

var_zhuan_wan_su_du = 40 # 「转到线」的转弯速度（固定 40）

# 「转到线」的两段判定通道： [左转先到, 左转后到, 右转先到, 右转后到]
#   4 光电 ： 左转 P1 -> P3      右转 P4 -> P2
#   循迹卡 ： 左转 ch1 -> ch4    右转 ch7 -> ch4
PID_TURN_4 = [1, 3, 4, 2]
PID_TURN_7 = [1, 4, 7, 4]

# 循迹卡重心法的位置权重：通道 1~7 对应 -3 ~ +3
PID_W7 = [-3, -2, -1, 0, 1, 2, 3]

# ---------------- 传感器读取 ----------------
#  4 光电 ： 巡线用模拟量 sensor.GetLightSensor(i)；压线判断用数字量 GetLightSensorData(i)
#  循迹卡 ： trace.GetTraceV2I2CState(P1端口, i)
#  巡线颜色 ： line_color() -> 黑线 = 1，白线 = 0
def use_trace():
    # 当前是否用循迹卡（7 光电）：E007 == 7
    return mode_idx() == 1

# ------- 循迹卡「压线电平」：通道读到几才算压线 -------
#  循迹卡的数字量有三种约定，不同批次/固件不一样：
#      A. 1 = 检测到线（卡自己带阈值，不分黑白）
#      B. 1 = 看到亮/白（跟模拟光值同向）
#      C. 1 = 看到黑（少数老固件）
#  写死任何一个值，总有一种「线 + 卡」的组合会判反 —— 车直接往线外跑。
#
#  通用判据：线永远是窄的，压线的通道一定是少数派。
#      数一遍 7 路里读到 1 的个数 cnt：
#          cnt 1~3  -> 少数派是 1 -> 压线电平 = 1（约定 A / B 的黑线）
#          cnt 5~6  -> 少数派是 0 -> 压线电平 = 0（约定 C，或约定 B 的白线）
#          cnt 4    -> 4:3 平局，判不出，返回 -1
#          cnt 7    -> 全 1，可能是路口，也可能是脱线，返回 -1
#          cnt 0    -> 全 0，整排都没读到 1，返回 -2
#
#  ★ cnt = 7 必须排除，不能当成「多数派是 1」！
#    7 路全读到 1 有两种情况：车压在十字/T 路口上，或者传感器脱线。
#    如果这时把电平缓存成 0，车开过路口后整片判断就反了 ——
#    现象是「前面巡得好好的，过了一个路口就开始往线外跑」。
#
#  ★ cnt = 0 要和「路口」分开处理，返回值不同（-2）。
#    全 0 意味着这一排没有任何一路读到 1。绝大多数约定下这就等于「车不在线上」，
#    必须让 on_line() 全部返回 False，才会走脱线找线。
#    如果按 line_color() 兜底：白线(0) + 约定A 时 on_line 会把 7 路全判成压线，
#    sum_v = 700 -> 误认为整排压线 -> 车直着冲出去，永远不找线。
#
#  ★ 白线千万不能直接写死 1。
#    白线 + 约定 A/B -> 压线是 1；
#    白线 + 约定 C（1=看到黑，黑底白线）-> 压线是 0，背景才是 1。
#    之前那版给白线特判 1，遇到约定 C 的卡就整片判反 —— 这是白线巡不了的第二个原因。
#    现在黑白线走同一套少数派判定，不再特判。
#  PID_TRACE_LEVEL：-1 = 自动判定（推荐）；0 / 1 = 手动强制
PID_TRACE_LEVEL = -1
_level_cache = -1        # 已判定出来的压线电平（0/1）；-1 = 还没判出来
_level_var   = -1        # 判定时的巡线颜色，颜色变了要重判
_level_now   = -1        # 本周期实际使用的电平；-1 = 本周期还没判

def count_one(n):
    # 数一遍阵列里读到 1 的路数
    cnt = 0
    for i in range(n):
        if trace.GetTraceV2I2CState(PID_TRACE_PORT, i + 1) == 1:
            cnt = cnt + 1
    return cnt

def trace_level():
    # 返回「压线时通道读到几」：
    #   0 / 1 = 判定成功
    #   -1    = 判不出（4:3 平局，或全 1 的路口）
    #   -2    = 整排全 0（车不在线上，或「1=看到黑」的卡压在白线路口上）
    global _level_cache, _level_var
    if _level_var != line_color():
        # 巡线颜色被改了（黑线地图 <-> 白线地图切换），电平要重新判定
        _level_cache = -1
        _level_var   = line_color()
    if _level_cache >= 0:
        return _level_cache
    if PID_TRACE_LEVEL >= 0:
        _level_cache = PID_TRACE_LEVEL
        return _level_cache
    cnt = count_one(7)
    if 1 <= cnt <= 3:
        _level_cache = 1            # 少数通道读到 1 -> 1 就是压线
    elif cnt == 5 or cnt == 6:
        _level_cache = 0            # 多数通道读到 1 -> 0 才是压线
    elif cnt == 0:
        return -2                   # 整排全 0：不能缓存（含义见 refresh_level）
    else:
        return -1                   # 4 平局 / 7 全 1（路口），下个周期再判
    return _level_cache

def refresh_level():
    # 每个巡线周期开头调用一次，把本周期要用的电平算出来。
    # 这样 on_line() 在紧循环里（比如「转到线」等线）不会每次都重读 7 路 I2C，
    # 否则光读传感器就能把巡线周期拖到几十毫秒，PID 直接失控。
    global _level_now
    lv = trace_level()
    if lv == -2:
        # 整排全 0，两种可能：
        #   a) 车真的不在线上（脱线 / 开机就在赛道外）
        #   b) 「1=看到黑」型循迹卡 + 白线：整排压着黑色横线路口
        # 保持上一周期的电平即可区分两者：
        #   a) 上一周期判的是 1，全 0 一个都对不上 -> on_line() 全部 False
        #      -> 正常触发脱线找线；
        #   b) 上一周期判的是 0，全 0 全部命中 -> 路口能被识别出来。
        # 首次调用时 _level_now 还是 -1，同样全部对不上，行为一致。
        pass
    elif lv < 0:
        _level_now = line_color()   # 路口等判不出的情况：按颜色约定兜底
    else:
        _level_now = lv

def on_line(i):
    # 第 i 路是否压线
    global _level_now
    if use_trace():
        if _level_now < 0:
            refresh_level()         # 还没算过：补算一次（判不出时会兜底成 0/1）
        return trace.GetTraceV2I2CState(PID_TRACE_PORT, i) == _level_now
    # 4 光电只有 4 路，少数派判不出稳定结果，直接用颜色约定（黑 1 / 白 0）
    return sensor.GetLightSensorData(i) == line_color()

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

# ---------------- 走过的距离：两轮编码绝对值的平均 ----------------
def wheel_dist():
    # 为什么不只读左轮、也不用带符号平均：
    #   1) 巡线走的是曲线，外侧轮比内侧轮多走一截。只看左轮的话，
    #      一直左转时左轮是内侧 -> 提前停；一直右转时左轮是外侧 -> 晚停。
    #      两轮平均才对应车身中心真正走过的路径。
    #   2) 单轮打滑 / 卡住时，另一轮的读数会把平均值撑起来，
    #      不会出现「左轮卡住 -> 永远等不到目标 -> while 死循环」。
    #   3) 取绝对值而不是带符号：满舵修正时内侧轮会短暂反转，
    #      带符号相加会把这段反转抵掉，原地打转时甚至恒等于 0，
    #      又变成死循环。取绝对值后，只要有轮在转，距离就会增长。
    # 转弯用 turn_bmz，它要的是「任意一轮转够」，不适用这个，所以它单独保留。
    return (math.fabs(motor.GetMotorCode(1)) + math.fabs(motor.GetMotorCode(2))) / 2.0

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

    # 限幅：4 光电的误差量纲是几百~几千，Kp 正常只有 0.0x 级。
    # 万一「设置PID」积木里填了循迹卡那种量级（0.8），修正量会瞬间到上千，
    # 车直接原地打转。这里统一按 PID_MAX_OUT 封顶，正常参数下根本碰不到。
    var_zhuan_dong_su_du = max(-PID_MAX_OUT, min(PID_MAX_OUT, var_zhuan_dong_su_du))

    if line_color() == 1:
        # 黑线：压线处光值低，误差为正表示线在左 -> 左轮减速
        speed_control(dead_zone(su_du - var_zhuan_dong_su_du),
                      dead_zone(su_du + var_zhuan_dong_su_du))
    else:
        # 白线：压线处光值高，误差符号整体反相 -> 左右轮对调
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

    if speed is None:
        speed = PID_BASE

    if not use_trace():
        # 差值法内部自己会 apply_param()，这里不要再调一次，
        # 否则 4 光电每个周期要白白多读一轮 E005 / E007
        return chai_zhi_xun_xian_once(speed)

    apply_param()                # 按 E005 + E007 装载当前生效的 Kp / Ki / Kd

    # 本周期只判一次压线电平，后面 7 次 read_black / 路口判断都复用这个结果
    refresh_level()

    n = 7
    w = PID_W7

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
#   另外要求「正中心那一路压线」：真路口 = 横线 + 主线同时存在；
#   虚线段整体偏到一侧时，最外侧虽然压线，但正中心是空的（线段偏出去了），
#   这时候不是路口。只靠最外侧判据会把虚线误判成路口，车一到虚线就停。
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
    # 主线是否还在：正中心那一路（7 路取第 4 路，4 路取第 2/3 路）压线。
    # 真路口 = 横线 + 主线同时存在，主线一定压在阵列正中心；
    # 虚线段整体偏到一侧时，最外侧虽然压线，但正中心是空的
    #（线段偏出去了，车正压在段沿上），这时候不是路口。
    # 只靠最外侧判据会把虚线误判成路口，车一到虚线就停。
    if n >= 7:
        mid = on_line(4)
    else:
        mid = on_line(2) or on_line(3)
    if jtype == 1:
        return left and mid and not right
    if jtype == 2:
        return right and mid and not left
    if jtype == 3:
        return left and right and mid
    return False

# ---------------- 巡线封装 ----------------
def run_straight_bmz(speed, bmp):
    # 纯直行 bmp 个编码值（不巡线）
    #   bmp > 0 -> 笔直前进     bmp < 0 -> 笔直倒退     bmp = 0 -> 不动
    # 用 dead_zone() 是为了和巡线时的等效基础速度一致
    # speed = 0 必须挡住：电机不转 -> 编码永远不增加 -> while 死循环
    if bmp == 0 or speed == 0:
        return
    sign = 1 if bmp > 0 else -1
    v = sign * dead_zone(abs(speed))
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while wheel_dist() < math.fabs(bmp):
        speed_control(v, v)

def xunxian_stop_junction(speed, jtype, adjust=0):
    # 巡线，遇到 jtype 路口后停车
    # jtype : 1 左路口 / 2 右路口 / 3 T路口
    #         4 左路口+冲出 / 5 右路口+冲出 / 6 T路口+冲出
    # adjust: 调整的编码值（默认 0，可正可负）
    #         不带冲出 -> 停稳之后直接微调：正数前进、负数后退
    #                    （不用先冲出再倒回来，一步到位）
    #         带冲出   -> 冲出距离 = E006 + adjust
    # 停车序列（找到路口后固定动作）：
    #   速度归 0 -> 等 0.1s -> 鸣笛 -> 等 0.1s
    # 巡线类积木只支持正速度：
    #   倒退巡线时左右轮的修正方向是反的（车尾朝前），PID 会越修越偏。
    #   速度 <= 0 直接返回，避免用户填负数后车乱跑或空转卡死。
    if speed <= 0:
        return
    # jtype 来自下拉菜单，正常生成的是整数 1~6。
    # 这里仍然 int() + 范围校验：
    #   万一平台把下拉值当字符串传进来，不 int() 的话下面 jtype > 3 会直接报错；
    #   万一是非法值，junction_detect() 永远返回 False，外层 while True 会一直跑下去。
    jtype = int(jtype)
    if jtype < 1 or jtype > 6:
        return
    pid_reset()
    out_flag = 0
    if jtype > 3:
        out_flag = 1
        jtype = jtype - 3
    # 找到路口立刻退出巡线循环：不再「开过路口区域」，
    # 停点就是压线那一刻的车身位置，横线正中间，不冲过线。
    # PID_JUNC_HOLD：连续这么多周期命中才算真路口。
    #   虚线段偏到一侧造成的误判只持续一两个周期，挡得住；
    #   真路口是连续的横线，会持续命中，不受影响（最多晚两周期停）。
    hold = 0
    while True:
        xunxian_once(speed)
        if junction_detect(jtype):
            hold = hold + 1
            if hold >= PID_JUNC_HOLD:
                break
        else:
            hold = 0
    if out_flag == 1:
        # 带冲出：检测到路口后笔直冲出 E006 + adjust
        run_straight_bmz(speed, rcu.GetData(PID_OUT_ADDR) + adjust)
    # 停车序列：速度先归 0，停稳 0.1s 再鸣笛，避免边滑行边叫
    speed_control(0, 0)
    rcu.SetWaitForTime(0.1)
    rcu.SetInBeep(1)
    rcu.SetWaitForTime(0.1)
    rcu.SetInBeep(0)
    if out_flag == 0 and adjust != 0:
        # 停稳之后的距离微调：正数笔直前进、负数笔直后退
        run_straight_bmz(speed, adjust)
        speed_control(0, 0)
        rcu.SetWaitForTime(0.1)

def xunxian_distance(speed, bmp):
    # 巡线走 bmp 个编码值（bmp 只取绝对值，负数也当正数）
    # 速度只支持正数：倒退巡线时左右修正方向是反的，会越走越偏
    # speed <= 0 也必须挡住：车不动 -> 编码不变 -> while 死循环
    target = math.fabs(bmp)
    if target == 0 or speed <= 0:
        return
    pid_reset()
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    while wheel_dist() < target:
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

def wait_on_line(ch):
    # 原地转，直到第 ch 路压线
    #   返回 True = 等到了；False = 保险丝烧了（说明线不在这边 / 传感器没读上）
    n = 0
    while not on_line(ch):
        n = n + 1
        if n > PID_TURN_MAX:
            return False
    return True

def turn_left_line():
    # 左轮后退 + 右轮前进 -> 车身左转；线从最左侧扫入，扫到接近中间就停
    speed_control(dead_zone(var_zhuan_wan_su_du * (-1)), dead_zone(var_zhuan_wan_su_du))
    if wait_on_line(turn_ch(0)):
        wait_on_line(turn_ch(1))
    speed_control(0, 0)
    rcu.SetWaitForTime(0.1)

def turn_right_line():
    speed_control(dead_zone(var_zhuan_wan_su_du), dead_zone(var_zhuan_wan_su_du * (-1)))
    if wait_on_line(turn_ch(2)):
        wait_on_line(turn_ch(3))
    speed_control(0, 0)
    rcu.SetWaitForTime(0.1)

_go_stalled = False      # 上一次「走距离」是不是因为停滞保护提前退出的

def go_stalled():
    # 上一次「走距离」有没有卡住被强制结束。
    #   正常走完 -> False
    #   电机堵转 / 轮子被卡 / 编码器线没插上 -> True
    # 需要区分「没走到位」和「正常走到了」的时候可以用它。
    return _go_stalled

def go_straight(sp, bmp):
    # 走直线：用编码器差分做同步，走满 bmp 个编码值
    #   sp  > 0 -> 前进        sp  < 0 -> 后退（速度带符号，负号就是倒退）
    #   bmp 只取绝对值（跟原厂一致：编码只填正数，填了负数也当正数）
    #
    # 停滞保护：编码值连续 PID_GO_TIMEOUT 秒（默认 3 秒）没有增长，
    #   就判定车已经走不动了（电机堵转 / 轮子被卡 / 编码器没接上），
    #   立刻停车并返回，让主程序继续执行下一条积木，不会把整场比赛卡死在这里。
    #   只要车还在动，哪怕走得很慢也不会被这个保护打断。
    global _go_stalled
    target = math.fabs(bmp)
    if target == 0 or sp == 0:
        return
    sign = 1 if sp > 0 else -1
    sp = math.fabs(sp)
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    _go_stalled = False
    last_dist = wheel_dist()
    t0 = time.time()
    while True:
        d = wheel_dist()
        if d >= target:
            break                       # 走够了
        if PID_GO_TIMEOUT > 0:
            if d > last_dist:
                last_dist = d           # 有进展 -> 重新计时
                t0 = time.time()
            elif time.time() - t0 > PID_GO_TIMEOUT:
                _go_stalled = True      # 停滞超时 -> 跳出，下面照常停车
                break
        left = math.fabs(motor.GetMotorCode(1))
        right = math.fabs(motor.GetMotorCode(2))
        diff = left - right
        left_speed = sp - diff * 0.3
        right_speed = sp + diff * 0.3
        left_speed = max(0, min(sp * 1.2, left_speed))
        right_speed = max(0, min(sp * 1.2, right_speed))
        # sign 只在这里乘上去：同步逻辑全用正数算，最后整体翻方向
        speed_control(dead_zone(sign * left_speed), dead_zone(sign * right_speed))
    motor.SetMotorStop(1)
    motor.SetMotorStop(2)
    rcu.SetWaitForTime(0.1)

def turn_bmz(spl, spr, bmp):
    # 左右轮以不同速度转，任意一轮走满 bmp 个编码值就停
    #   spl / spr 可以填负数（那就是反转），bmp 只取绝对值
    # 这里故意不用 wheel_dist()：
    #   原地转时两轮一正一负，平均会互相抵消（甚至恒等于 0），永远停不下来。
    #   转弯要的是「外侧轮转够了」，所以取两轮里较大的那个。
    # 两轮都为 0 时必须挡住：车不动 -> 编码不变 -> while 死循环
    target = math.fabs(bmp)
    if target == 0 or (spl == 0 and spr == 0):
        return
    motor.SetMotorCode(1)
    motor.SetMotorCode(2)
    # 也要过 dead_zone：如果用户填的速度落在电机死区里（比如死区 10、速度填 5），
    # 电机不会转 -> 编码不增加 -> while 永远出不来
    while max(math.fabs(motor.GetMotorCode(1)), math.fabs(motor.GetMotorCode(2))) <= target:
        speed_control(dead_zone(spl), dead_zone(spr))
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
# 手动覆盖   :  set_pid_override(0.8, 0, 1.6)   # 「设置PID Kp Ki Kd」积木生成的就是这一行
#                注意：这一组值对 4 光电和循迹卡同时生效，两者量纲差两个数量级
#                想回到四组默认表：clear_pid_override()
# 改巡线颜色 :  set_line_color(0)               # 0 = 白线，1 = 黑线
#                「初始化 巡线颜色」积木生成的就是这一行
# 白线巡不了 :  先确认程序里真的有 set_line_color(0)；
#                还不行再看 PID_TRACE_LEVEL（-1 自动 / 0 / 1 强制，只管循迹卡）
# 后退       :  只有「走距离」支持负速度；巡线类积木只认正数
#                （倒退巡线时左右修正方向是反的，会越走越偏）
# 量距离     :  wheel_dist()  = 两轮编码绝对值的平均，三个「走距离」类积木都用它
#                （只读左轮会因打滑 / 曲线偏差而失准，单轮卡住还会死循环）
`;

        return {
            Python: {
                // 初始化：引入模块 + 设定巡线颜色 + 注入整段底层
                block_init: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("time"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let line_color = block.getFieldValue("line_color");

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    // 不直接给变量赋值：万一积木体落在函数体内，那就是局部变量，
                    // 底层所有函数读到的仍是全局默认值 1 —— 白线就会按黑线跑。
                    // 改成调用 set_line_color()，由它去改 PID_CFG 里的元素，
                    // 不管生成在模块级还是函数内都一定生效。
                    return `set_line_color(${line_color})\r\n`;
                },

                // 设置PID参数：用过这个积木 -> 用积木里填的 Kp / Ki / Kd
                //               没用过     -> 底层四组默认表按 E005 × E007 自动选
                block_pidset: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let kp = ScratchBlocks.Python.valueToCode(block, "kp", 16);
                    let ki = ScratchBlocks.Python.valueToCode(block, "ki", 16);
                    let kd = ScratchBlocks.Python.valueToCode(block, "kd", 16);

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    return `set_pid_override(${kp}, ${ki}, ${kd})\r\n`;
                },

                // 巡线遇路口停
                block_junction: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let jtype = block.getFieldValue("jtype");
                    let adjust = ScratchBlocks.Python.valueToCode(block, "adjust", 16);

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    return `xunxian_stop_junction(${speed}, ${jtype}, ${adjust})\r\n`;
                },

                // 巡线距离
                block_xdistance: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let speed = ScratchBlocks.Python.valueToCode(block, "speed", 16);
                    let bmp = ScratchBlocks.Python.valueToCode(block, "bmp", 16);

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    return `xunxian_distance(${speed}, ${bmp})\r\n`;
                },

                // 左 / 右 转到线
                block_turnline: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let dir = block.getFieldValue("dir");

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    // 转弯速度固定 40，在底层里已经设好（var_zhuan_wan_su_du），这里不用再传
                    if (dir === "1") {
                        return `turn_left_line()\r\n`;
                    }
                    return `turn_right_line()\r\n`;
                },

                // 走距离
                block_gostraight: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("time"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let sp = ScratchBlocks.Python.valueToCode(block, "sp", 16);
                    let bmp = ScratchBlocks.Python.valueToCode(block, "bmp", 16);

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    return `go_straight(${sp}, ${bmp})\r\n`;
                },

                // 转编码值
                block_turnbmz: function (block) {
                    (ScratchBlocks.Python.Import("rcu"),
                        ScratchBlocks.Python.Import("math"),
                        ScratchBlocks.Python.Import("motor"),
                        ScratchBlocks.Python.Import("sensor"),
                        ScratchBlocks.Python.Import("trace"));

                    let spl = ScratchBlocks.Python.valueToCode(block, "spl", 16);
                    let spr = ScratchBlocks.Python.valueToCode(block, "spr", 16);
                    let bmp = ScratchBlocks.Python.valueToCode(block, "bmp", 16);

                    ScratchBlocks.Python.functionNames_["PID巡线_底层"] = CORE;

                    return `turn_bmz(${spl}, ${spr}, ${bmp})\r\n`;
                },
            },
        };
    }

    getInfo() {
        return {
            id: "PIDXunXian0001E6E7M6",
            name: "PID巡线",
            color1: "#c0392b",
            color2: "#96281b",
            color3: "#96281b",
            blockIconURI:
                (this.imgs && this.imgs.blockIcon && this.imgs.blockIcon["PID"]) ||
                "",
            menuIconURI:
                (this.imgs && this.imgs.menuIcon && this.imgs.menuIcon["PID"]) ||
                "",
            supportDevice: ["E6", "E7", "M6"],
            blocks: [
                {
                    opcode: "block_init",
                    blockType: "command",
                    text: "初始化 巡线颜色 [line_color]",
                    arguments: {
                        line_color: {
                            type: "string",
                            menu: "menu_line_color",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_pidset",
                    blockType: "command",
                    text: "设置PID Kp [kp] Ki [ki] Kd [kd]",
                    arguments: {
                        kp: {
                            type: "number",
                            defaultValue: "0.8",
                        },
                        ki: {
                            type: "number",
                            defaultValue: "0",
                        },
                        kd: {
                            type: "number",
                            defaultValue: "1.6",
                        },
                    },
                },
                {
                    opcode: "block_junction",
                    blockType: "command",
                    text: "巡线遇路口停 速度 [speed] 路口类型 [jtype] 调整编码值 [adjust]",
                    arguments: {
                        speed: {
                            type: "number",
                            defaultValue: "50",
                        },
                        jtype: {
                            type: "string",
                            menu: "menu_junction",
                            defaultValue: "1",
                        },
                        adjust: {
                            type: "number",
                            defaultValue: "0",
                        },
                    },
                },
                {
                    opcode: "block_xdistance",
                    blockType: "command",
                    text: "巡线距离 速度 [speed] 编码值 [bmp]",
                    arguments: {
                        speed: {
                            type: "number",
                            defaultValue: "50",
                        },
                        bmp: {
                            type: "number",
                            defaultValue: "1000",
                        },
                    },
                },
                {
                    opcode: "block_turnline",
                    blockType: "command",
                    text: "[dir] 转到线",
                    arguments: {
                        dir: {
                            type: "string",
                            menu: "menu_dir",
                            defaultValue: "1",
                        },
                    },
                },
                {
                    opcode: "block_gostraight",
                    blockType: "command",
                    text: "走距离 速度 [sp] 编码值 [bmp]",
                    arguments: {
                        sp: {
                            type: "number",
                            defaultValue: "50",
                        },
                        bmp: {
                            type: "number",
                            defaultValue: "1000",
                        },
                    },
                },
                {
                    opcode: "block_turnbmz",
                    blockType: "command",
                    text: "转编码值 左轮速度 [spl] 右轮速度 [spr] 编码值 [bmp]",
                    arguments: {
                        spl: {
                            type: "number",
                            defaultValue: "50",
                        },
                        spr: {
                            type: "number",
                            defaultValue: "-50",
                        },
                        bmp: {
                            type: "number",
                            defaultValue: "500",
                        },
                    },
                },
            ],
            menus: {
                menu_line_color: "menu_line_color",
                menu_junction: "menu_junction",
                menu_dir: "menu_dir",
            },
        };
    }

    menu_line_color() {
        return [
            {
                text: "黑线",
                value: "1",
            },
            {
                text: "白线",
                value: "0",
            },
        ];
    }

    menu_junction() {
        return [
            {
                text: "左路口",
                value: "1",
            },
            {
                text: "右路口",
                value: "2",
            },
            {
                text: "T路口",
                value: "3",
            },
            {
                text: "左路口+冲出",
                value: "4",
            },
            {
                text: "右路口+冲出",
                value: "5",
            },
            {
                text: "T路口+冲出",
                value: "6",
            },
        ];
    }

    menu_dir() {
        return [
            {
                text: "左",
                value: "1",
            },
            {
                text: "右",
                value: "2",
            },
        ];
    }

    block_init(args) {}
    block_pidset(args) {}
    block_junction(args) {}
    block_xdistance(args) {}
    block_turnline(args) {}
    block_gostraight(args) {}
    block_turnbmz(args) {}
}
(function () {
    return {
        PIDXunXian0001E6E7M6: PIDXunXian0001E6E7M6Block,
    };
})();
