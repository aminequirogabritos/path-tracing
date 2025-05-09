import ctypes
from pynvml import *

ctypes.WinDLL(r"C:\Windows\System32\nvml.dll")  # Explicit load
nvmlInit()
handle = nvmlDeviceGetHandleByIndex(0)
print("GPU Name:", nvmlDeviceGetName(handle))
nvmlShutdown()
