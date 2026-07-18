import curses
import random

def main(stdscr):
    # 初始化设置
    curses.curs_set(0)          # 隐藏闪烁的光标
    stdscr.timeout(100)         # 游戏刷新速度（单位：毫秒），数值越小，蛇移动越快
    
    # 获取当前终端窗口的宽高尺寸
    sh, sw = stdscr.getmaxyx()
    
    # 初始化蛇的初始位置和身体（由 3 个坐标节点组成，初始向右移动）
    snk_x = sw // 4
    snk_y = sh // 2
    snake = [
        [snk_y, snk_x],
        [snk_y, snk_x - 1],
        [snk_y, snk_x - 2]
    ]
    
    # 初始化食物的位置（用 '*' 表示）
    food = [sh // 2, sw // 2]
    stdscr.addch(food[0], food[1], '*')
    
    # 默认蛇的移动方向为向右
    key = curses.KEY_RIGHT
    score = 0

    while True:
        # 在左上角实时绘制分数
        stdscr.addstr(0, 2, f" 分数 (Score): {score} ")
        
        # 获取用户键盘输入
        next_key = stdscr.getch()
        
        # 捕获输入方向（并防止蛇直接“回头自咬”）
        if next_key != -1:
            if (key == curses.KEY_DOWN and next_key != curses.KEY_UP and next_key != ord('w')) or \
               (key == curses.KEY_UP and next_key != curses.KEY_DOWN and next_key != ord('s')) or \
               (key == curses.KEY_LEFT and next_key != curses.KEY_RIGHT and next_key != ord('d')) or \
               (key == curses.KEY_RIGHT and next_key != curses.KEY_LEFT and next_key != ord('a')):
                key = next_key
            elif next_key in [curses.KEY_DOWN, curses.KEY_UP, curses.KEY_LEFT, curses.KEY_RIGHT, ord('w'), ord('s'), ord('a'), ord('d')]:
                key = next_key

        # 计算蛇头下一个坐标位置
        new_head = [snake[0][0], snake[0][1]]

        # 支持方向键 & WASD 键盘控制
        if key == curses.KEY_DOWN or key == ord('s'):
            new_head[0] += 1
        elif key == curses.KEY_UP or key == ord('w'):
            new_head[0] -= 1
        elif key == curses.KEY_LEFT or key == ord('a'):
            new_head[1] -= 1
        elif key == curses.KEY_RIGHT or key == ord('d'):
            new_head[1] += 1

        # 判定撞墙或自撞（游戏结束）
        if (new_head[0] <= 0 or new_head[0] >= sh - 1 or
            new_head[1] <= 0 or new_head[1] >= sw - 1 or
            new_head in snake):
            break

        # 将新蛇头塞入身体列表的最前方
        snake.insert(0, new_head)

        # 蛇吃到食物逻辑
        if snake[0] == food:
            score += 1
            food = None
            # 重新生成食物，确保不会生成在蛇的身体上
            while food is None:
                nf = [
                    random.randint(1, sh - 2),
                    random.randint(1, sw - 2)
                ]
                food = nf if nf not in snake else None
            stdscr.addch(food[0], food[1], '*')
        else:
            # 没有吃到食物，蛇向前移动：删掉尾巴，并在屏幕上把尾巴清除
            tail = snake.pop()
            stdscr.addch(tail[0], tail[1], ' ')

        # 在屏幕上画出新的蛇头
        stdscr.addch(snake[0][0], snake[0][1], '#')

    # 游戏结束（Game Over）画面
    stdscr.timeout(-1)  # 停止计时，等待玩家按任意键退出
    stdscr.clear()
    stdscr.addstr(sh // 2 - 1, sw // 2 - 5, "GAME OVER", curses.A_BOLD)
    stdscr.addstr(sh // 2 + 1, sw // 2 - 9, f"Final Score: {score}")
    stdscr.addstr(sh // 2 + 3, sw // 2 - 13, "Press any key to exit...")
    stdscr.getch()

if __name__ == "__main__":
    # 使用 curses 包装器，确保程序退出或崩溃时终端能恢复正常，不至于乱码
    curses.wrapper(main)