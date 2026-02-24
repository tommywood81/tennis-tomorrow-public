"""
PyTorch model definition for the experimental LSTM strategy.
"""

from __future__ import annotations

import torch
from torch import nn


class DualBranchLSTM(nn.Module):
    """
    LSTM branch for sequence data plus MLP for static features.

    Parameters
    ----------
    seq_input_dim : int
        Number of per-timestep sequence features.
    static_input_dim : int
        Number of static features.
    lstm_hidden : int
        Hidden units in the LSTM encoder.
    lstm_layers : int
        Number of stacked LSTM layers.
    dropout : float
        Dropout rate applied after dense layers.
    """

    def __init__(
        self,
        seq_input_dim: int,
        static_input_dim: int,
        lstm_hidden: int = 64,
        lstm_layers: int = 1,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=seq_input_dim,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
        )
        self.static_mlp = nn.Sequential(
            nn.Linear(static_input_dim + lstm_hidden, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

    def forward(self, sequence, static, mask=None):
        lstm_out, _ = self.lstm(sequence)
        if mask is not None:
            mask = mask.unsqueeze(-1)
            lstm_out = lstm_out * mask
        pooled = lstm_out[:, -1, :]
        combined = torch.cat([pooled, static], dim=1)
        logits = self.static_mlp(combined).squeeze(-1)
        return logits

