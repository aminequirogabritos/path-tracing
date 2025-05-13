After downloading the project, run the following commands:

npm install
npm run dev

--------------------------------------------------------------
To log and save GPU usage (nvidia card)

nvidia-smi --query-gpu=timestamp, utilization.gpu, temperature.gpu, memory.used, memory.total --format=csv -l [period in seconds] > [filename].csv

^^^ PROBLEM: only registers 1 second

--------------------------------------------------------------

on .env file, set env vars for cooldown, e.g.

VITE_SCENE_NUMBER = 1

# for GTX970:
VITE_SCENE_1_COOLDOWN = 30
VITE_SCENE_2_COOLDOWN = 400
VITE_SCENE_3_COOLDOWN = 10

---------------------------------------------------------------


To log with less than 1 sample per second

Ubuntu:

python3 -m venv venv (first time)
source venv/bin/activate
python profiler/ubuntu/profiler.py
deactivate

Windows (cmd as admin):

python -m venv venv (first time)
venv\Scripts\activate
pip install nvidia-ml-py3 (first time)
python profiler/windows/profiler.py --scene [scene name] --interval [interval in seconds]
venv\Scripts\deactivate
