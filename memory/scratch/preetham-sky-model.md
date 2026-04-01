# Preetham Sky Model Implementation
uses: 1
created: 2026-04-01
updated: 2026-04-01

## What
Physically-based atmospheric scattering model for realistic sky rendering.
Based on "A Practical Analytic Model for Daylight" (Preetham et al. 1999).

## Key Concepts
- **Perez luminance distribution**: F(θ,γ) = (1 + Ae^(B/cosθ))(1 + Ce^(Dγ) + Ecos²γ)
  - θ = zenith angle of view direction
  - γ = angle between view and sun
  - A-E coefficients depend on turbidity
- **CIE Yxy color space**: Luminance (Y) + chromaticity (x,y)
  - Compute Y, x, y separately with different Perez coefficients
  - Convert Yxy → XYZ → linear sRGB
- **Turbidity**: 2 = crystal clear, 10 = very hazy
  - Higher turbidity → less blue saturation, more scattering
- **Sun disk**: Limb darkening (1 - t²), corona glow (exponential falloff)

## Gotchas
- Must handle θ=0 (looking straight up) carefully — avoid division issues
- Below-horizon directions need special handling (dark ground)
- Zenith luminance formula involves tan(chi) — can go negative at extreme angles
- Web worker implementation needs inline code (can't import ES modules)

## Performance
- Precompute: zenith values, Perez(0, thetaS) for all three channels
- Runtime per ray: 3 Perez evaluations + Yxy→RGB conversion
- For web workers: closure captures precomputed values
