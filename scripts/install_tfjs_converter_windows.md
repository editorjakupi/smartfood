# TensorFlow.js converter på Windows (utan tensorflow-decision-forests)

På Windows kraschar `tensorflowjs` 4.x eftersom det drar in `tensorflow-decision-forests`, som förlitar sig på en `.so`-fil som inte finns på Windows.

**Lösning:** Använd `tensorflowjs==3.21.0`, som **inte** har `tensorflow-decision-forests` som beroende.

## Steg

1. Avinstallera befintlig tensorflowjs och tensorflow-decision-forests:

   ```powershell
   python -m pip uninstall tensorflow-decision-forests tensorflowjs -y
   ```

2. Installera tensorflowjs 3.21.0 **utan** att ändra TensorFlow/protobuf (`--no-deps` undviker versionskonflikt):

   ```powershell
   python -m pip install tensorflowjs==3.21.0 --no-deps
   ```

3. Installera h5py (för att läsa .h5-modeller):

   ```powershell
   python -m pip install h5py
   ```

4. Kör konverteringen:

   ```powershell
   cd "studymodules\NBI Handlesakademin\AI - teori och tillämpning\del2\Kunskapkskontroll\del2\smartfood"
   python convert_lstm_to_tfjs_simple.py
   ```

Kräver att LSTM-modellen redan finns: `data/models/lstm/eating_pattern_model.h5` (t.ex. sparad efter att du kört notebooken `notebooks/lstm/lstm_eating_patterns.ipynb`).
