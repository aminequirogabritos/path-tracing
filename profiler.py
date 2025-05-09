import csv, time, argparse
from pynvml import *

import os
import ctypes

# Force-load nvml.dll manually
nvml_path = r"C:\Windows\System32\\nvml.dll"
ctypes.WinDLL(nvml_path)

nvmlInit()

# Parse arguments
parser = argparse.ArgumentParser(description="GPU Logger")
parser.add_argument("--scene", type=str, required=True, help="Scene name (used for CSV filename)")
parser.add_argument("--interval", type=float, default=0.266, help="Sleep time between samples (in seconds)")
args = parser.parse_args()

sleep_time = args.interval
filename = f"{args.scene}.csv"

handle = nvmlDeviceGetHandleByIndex(0)

with open(filename, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Time', 'GPU Util (%)', 'Memory Used (MB)', 'Temp (C)'])

    try:
        while True:
            util = nvmlDeviceGetUtilizationRates(handle)
            mem = nvmlDeviceGetMemoryInfo(handle)
            temp = nvmlDeviceGetTemperature(handle, NVML_TEMPERATURE_GPU)
            current_time = time.strftime("%H:%M:%S.") + f"{int((time.time() * 1000) % 1000):03d}"
            writer.writerow([current_time, util.gpu, mem.used // (1024**2), temp])
            f.flush()
            time.sleep(sleep_time)
    except KeyboardInterrupt:
        print("Logging stopped.")
        nvmlShutdown()
