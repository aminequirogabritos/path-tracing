import csv, time
from pynvml import *

nvmlInit()
handle = nvmlDeviceGetHandleByIndex(0)

with open('scene_2.csv', 'w', newline='') as f:
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
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("Logging stopped.")
        nvmlShutdown()


