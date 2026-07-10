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

<img width="512" height="512" alt="sample_9_scene_1_10samples_5bounces_5spp_512px" src="https://github.com/user-attachments/assets/d82d393e-0ef5-46ca-84c4-f15ba0bdcfd7" />
<img width="512" height="512" alt="sample_9_scene_2_10samples_5bounces_5spp_512px" src="https://github.com/user-attachments/assets/742fc5de-903f-4ec1-9ee9-dc2cab436b4b" />
<img width="512" height="512" alt="sample_9_scene_3_10samples_5bounces_5spp_512px" src="https://github.com/user-attachments/assets/c42a6156-3415-4a36-be91-68f6fae1bd6f" />
