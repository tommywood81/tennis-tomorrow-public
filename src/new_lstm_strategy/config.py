from pathlib import Path


class NewLSTMConfig:
    """Global defaults for the experimental LSTM setup."""

    data_path = Path("data/processed/preprocessed_data.csv")
    artifacts_root = Path("experiments/new_lstm")
    include_tourney_level = True
    include_round = True

    # Default temporal split: train ≤ 2022, val 2023, test 2024
    train_cutoff = 20221231
    val_cutoff = 20231231

    seq_len = 10
    half_life = 3.0
    lstm_hidden = 64
    lstm_layers = 1
    dropout = 0.3
    batch_size = 128
    epochs = 5
    patience = 3
    learning_rate = 1e-3
    device = "cuda"
    random_seed = 42


config = NewLSTMConfig()

