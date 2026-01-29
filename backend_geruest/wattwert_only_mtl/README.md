# Multi-Task Learning for Facade Segmentation

This project implements a multi-task learning model based on DeepLabV3+ to perform semantic segmentation on building facades for both elements (windows, doors) and materials (brick, stucco).

## Project Structure

- `configs/`: Contains configuration files (e.g., `config.yaml`).
- `data/`: Placeholder for raw data (not tracked by Git).
- `runs/`: Contains output files like logs and saved models (not tracked by Git).
- `scripts/`: Executable scripts for training and evaluation.
- `src/`: Main source code for the project.
- `requirements.txt`: Project dependencies.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd wattwert_only_mtl
    ```

2.  **Create a virtual environment (recommended):**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

## Usage

### Configuration

Before running, review and adjust the settings in `configs/config.yaml`. Update data paths and hyperparameters as needed.

### Training

To start training the model, run the training script:

```bash
python scripts/train.py
```

TensorBoard logs will be saved to the directory specified by `log_dir_base` in the config, and the final model will be saved to the `save_path`.

### Evaluation

<!-- '''To evaluate a trained model, run the evaluation script:

```bash
python scripts/run_evaluation.py''' -->

### Inference

To run inference on a single image and calculate the Window-to-Wall Ratio (WWR):

```bash
python scripts/infer.py --image_path "path/to/your/image.jpg" --output_dir "runs/inference"
```

#### Example Results

**Test Image**: `DSC00157.JPG`
- **Window pixels**: 36,766
- **Building/Wall pixels**: 226,298
- **Total facade pixels**: 263,064
- **Window-to-Wall Ratio**: 0.1398 (13.98%)

The inference script generates:
1. **Element Prediction**: Segmentation showing windows, doors, and building elements
2. **Material Prediction**: Segmentation showing different building materials (brick, stucco, etc.)
3. **WWR Analysis**: Detailed pixel count and ratio calculations

Results are saved as visualization images in the specified output directory.

#### Window-to-Wall Ratio (WWR)

The model automatically calculates the WWR, which is an important metric in building energy efficiency:
- **WWR = Window Area / Total Facade Area**
- Typical values range from 10-40% depending on building type and energy requirements


```