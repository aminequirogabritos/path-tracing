After downloading the project, run the following commands:

npm install
npm run dev


To log and save GPU usage (nvidia card)

nvidia-smi --query-gpu=timestamp, utilization.gpu, temperature.gpu, memory.used, memory.total --format=csv -l [period in seconds] > [filename].csv
