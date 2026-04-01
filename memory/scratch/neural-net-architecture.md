---
topic: neural-net-architecture
uses: 3
created: 2026-04-01
updated: 2026-04-01
---

# Neural Net Framework Architecture

## Layer Types Implemented
- **Dense** — Fully connected, Xavier init
- **Conv2D** — im2col forward, col2im backward, padding, stride, multi-channel
- **MaxPool2D** — Max pooling with gradient routing to max positions
- **RNN** — Elman network, BPTT, returnSequences option
- **LSTM** — 4 gates (input/forget/cell/output), forget bias = 1, BPTT
- **GRU** — 3 gates (update/reset/candidate), 25% fewer params than LSTM, BPTT
- **SelfAttention** — Scaled dot-product: softmax(QK^T / √d_k) · V, full backward
- **MultiHeadAttention** — Head splitting, independent attention, concatenation
- **TransformerEncoderBlock** — Attention + FFN + residual + LayerNorm
- **PositionalEncoding** — Sinusoidal (sin/cos at different frequencies)
- **LayerNorm** — Per-position normalization across features
- **BatchNorm** — Running mean/variance, training/eval modes
- **Dropout** — Inverted dropout
- **Embedding** — Token lookup table, sparse gradient updates
- **Residual** — Skip connections (He et al. 2015)
- **Sequential** — Layer chain wrapper
- **Flatten** — Reshape

## Architectures
- **Autoencoder** — Encoder/decoder, denoising support
- **VAE** — Reparameterization trick, KL divergence, generate()
- **GAN** — Generator vs discriminator, label smoothing, multi-step D training
- **DDPM** — Denoising Diffusion Probabilistic Model

## Key Insights
1. **Col2im backward for Conv2D**: gradients accumulate at overlapping positions
2. **LSTM forget gate bias = 1**: network starts by remembering (learn to forget)
3. **Adam bias correction**: early steps biased toward zero without correction
4. **Attention softmax backward**: Jacobian is S_i(dO_i - Σ(dO_j · S_j)), NOT s(1-s)
5. **VAE reparameterization**: z = μ + σ·ε allows backprop through sampling
6. **Decoupled weight decay (AdamW)**: apply WD to params directly, not through adaptive lr
7. **GRU vs LSTM**: GRU has 3 gates (75% params), competitive performance for short sequences
8. **Residual connections**: skip paths let gradients flow directly, enabling deep networks

## Test Count: 249
