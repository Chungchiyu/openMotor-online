"""Golden values for src/physics/__tests__/transient.reference.test.ts from the Python original.

Runs sugar-ballistics' transient model (sbal.engine.Chamber + MotorlibGeometry) on motorlib grains, the
way diver-sim does (diver/transient.py), for a few of the existing reference motors, and writes
src/physics/__fixtures__/ref_transient.json.

    pip install numpy scipy pyyaml cython scikit-fmm
    python tools/build_openmotor.py            # in a sugar-ballistics or diver-sim checkout
    OPENMOTOR_DIR=.../openMotor SBAL_DIR=.../sugar-ballistics python scripts/transient_reference.py
"""
import json
import math
import os
import sys
import warnings
from pathlib import Path

sys.path.insert(0, os.environ["OPENMOTOR_DIR"])
sys.path.insert(0, os.environ["SBAL_DIR"])

import motorlib.motor  # noqa: E402
from sbal.engine import Chamber, MotorlibGeometry, Options, preset  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "src" / "physics" / "__fixtures__"
RECORD = 0.005

# name, fixture, settings in the app's TransientSettings shape (toggles + options)
VALIDATED = dict(ignition=True, tailOff=True, smoothBurnRate=False, calibration=False,
                 options=dict(igniterPressure=0.3e6, igniterTime=0.1, spreadRefLength=0.3, tauCore=0.101,
                              tauEnd=0.040, ecc=0.185))
CASES = [
    ("simple_validated", "ref_simple.json", VALIDATED),
    ("simple_openmotor", "ref_simple.json", dict(ignition=False, tailOff=False, smoothBurnRate=False,
                                                 calibration=False, options={})),
    ("knsb_everything", "ref_knsb.json", dict(
        ignition=True, tailOff=True, smoothBurnRate=True, calibration=True,
        options=dict(igniterPressure=0.5e6, igniterTime=0.05, igniterProfile="decay", plugBurst=0.4e6, tauCore=0.08,
                     tauEnd=0.03, endStart=0.6, ignitionShape="smooth", spreadExponent=0.3, pRef=3e6, ecc=0.25,
                     bandBlend=0.2, etaCstar=0.93, burnRateScale=1.05, etaNozzle=0.92, freeVolumeExtra=2e-5))),
    ("moon_validated", "ref_moon.json", VALIDATED),
    # an end burner fills its envelope: the model needs some free volume (here 20 cm^3) to start from
    ("endburner_validated", "ref_endburner.json", dict(VALIDATED, options=dict(VALIDATED["options"], freeVolumeExtra=2e-5))),
]

# app option name -> sbal Options field
NAMES = dict(etaCstar="eta_cstar", etaNozzle="eta_nozzle", burnRateScale="burn_rate_scale",
             igniterPressure="igniter_pressure", igniterTime="igniter_time", igniterProfile="igniter_profile",
             plugBurst="plug_burst", tauCore="tau_core", tauEnd="tau_end", endStart="end_start",
             ignitionShape="ignition_shape", spreadExponent="spread_exponent", spreadRefLength="spread_ref_length",
             pRef="p_ref", bandBlend="band_blend", ecc="ecc", dt="dt", tMax="t_max", freeVolumeExtra="free_volume_extra")


def sbal_options(settings, motor_dict):
    """effectiveTransientOptions() of src/physics/transient/options.ts, as sbal Options."""
    opts = {NAMES[k]: v for k, v in settings["options"].items()}
    base = Options()
    opts["instant_ignition"] = not settings["ignition"]
    if not settings["tailOff"]:
        opts["ecc"] = 0.0
    if not settings["smoothBurnRate"]:
        opts["band_blend"] = 0.0
    if not settings["calibration"]:
        opts.update(eta_cstar=base.eta_cstar, burn_rate_scale=1.0, eta_nozzle=motor_dict["nozzle"]["efficiency"])
    opts["p_amb"] = motor_dict["config"]["ambPressure"]
    return Options(**opts)


class _Grain:
    def __init__(self, propellant, length):
        self.propellant, self.burn_rate_scale, self.length = propellant, 1.0, length


def run(motor_dict, settings):
    motor = motorlib.motor.Motor(motor_dict)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        motor.runSimulation()                     # sets the grains up, as diver/ballistic.py
    o = sbal_options(settings, motor_dict)
    geo = MotorlibGeometry(motor.grains, ecc=o.ecc)
    noz = motor_dict["nozzle"]
    grains = [_Grain(motor_dict["propellant"], g.getProperty("length")) for g in motor.grains]
    ch = Chamber(grains, geo, noz["throat"], noz["exit"], o, div_angle=noz["divAngle"], conv_angle=noz["convAngle"],
                 throat_length=noz["throatLength"])
    stride = max(1, round(RECORD / o.dt))
    out = dict(t=[0.0], p=[ch.p], f=[ch.thrust()], mdot=[ch.mdot], mass=[ch.prop_mass])
    steps, expelled = 0, 0.0
    while not ch.done and ch.t < o.t_max:
        ch.step(o.dt)
        steps += 1
        expelled += ch.mdot * o.dt
        if steps % stride == 0 or ch.done:
            out["t"].append(ch.t)
            out["p"].append(ch.p)
            out["f"].append(ch.thrust())
            out["mdot"].append(ch.mdot)
            out["mass"].append(ch.prop_mass)
    impulse = sum(0.5 * (out["f"][i] + out["f"][i + 1]) * (out["t"][i + 1] - out["t"][i]) for i in range(len(out["t"]) - 1))
    # every 4th sample (0.02 s) to keep the fixture small; the test interpolates its own run at these times
    out = {k: [float(f"{x:.7g}") for x in v[::4]] for k, v in out.items()}
    # expelled / burnt - 1: not exactly 0 for FMM grains, whose area and volume tables don't satisfy dV/dx = A
    return dict(out, mProp0=ch.m_prop0, pMax=ch.p_max, impulse=impulse, burnTime=ch.t,
                massBalance=expelled / ch.m_prop0 - 1)


def main():
    result = {}
    for name, fixture, settings in CASES:
        motor_dict = json.loads((FIXTURES / fixture).read_text())["motorDict"]
        result[name] = dict(fixture=fixture, settings=settings, **run(motor_dict, settings))
        r = result[name]
        print(f"{name}: burn {r['burnTime']:.3f} s, p_max {r['pMax'] / 1e6:.3f} MPa, I {r['impulse']:.1f} Ns, "
              f"{len(r['t'])} samples")
    (FIXTURES / "ref_transient.json").write_text(json.dumps(result))


if __name__ == "__main__":
    main()
