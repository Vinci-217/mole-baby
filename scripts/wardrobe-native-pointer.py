"""Send real X11 pointer events to the isolated Linux Electron QA window."""
import ctypes as C
import ctypes.util
import sys
import time

x11=C.CDLL(ctypes.util.find_library('X11'))
xtst=C.CDLL(ctypes.util.find_library('Xtst'))
x11.XOpenDisplay.argtypes=[C.c_char_p]
x11.XOpenDisplay.restype=C.c_void_p
x11.XFlush.argtypes=[C.c_void_p]
x11.XCloseDisplay.argtypes=[C.c_void_p]
xtst.XTestFakeMotionEvent.argtypes=[C.c_void_p,C.c_int,C.c_int,C.c_int,C.c_ulong]
xtst.XTestFakeButtonEvent.argtypes=[C.c_void_p,C.c_uint,C.c_int,C.c_ulong]
display=x11.XOpenDisplay(None)
if not display:raise SystemExit('An isolated Xvfb display is required')
def move(x,y):
    xtst.XTestFakeMotionEvent(display,-1,round(x),round(y),0)
    x11.XFlush(display)
def button(down):
    xtst.XTestFakeButtonEvent(display,1,int(down),0)
    x11.XFlush(display)
try:
    if sys.argv[1]=='release':button(False)
    else:
        x,y,direction=map(float,sys.argv[1:])
        move(x,y);time.sleep(.08);button(True);time.sleep(.1)
        for step in range(1,49):move(x+direction*step*5,y);time.sleep(.025)
        time.sleep(.06)
finally:x11.XCloseDisplay(display)
