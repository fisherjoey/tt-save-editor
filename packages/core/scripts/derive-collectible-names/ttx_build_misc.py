#!/usr/bin/env python3
import json, re

d = json.load(open('/tmp/ttx_targets.json'))
MINE = ["Activities","Challenges","Conversations","Tutorials","RandomCrimes","Crimes",
        "DiscoveryTowers","FastTravel","FastTravelUnlock","ARVRTraining","Islands","Batcave",
        "Shops","GadgetBench","BrutalBat","Eras","GameMenu","RoadClosures","LeavingAreaSplines",
        "BatSignal","Gifts","StaticTraversal","LoadingScreen"]

PFX = "GameProgress.Definitions."
out = {}

# ---- District/island lookup (authoritative, from ST_UI string table) ----
DISTRICT = {
    "TC01": "Tricorner",
    "OG01": "Old Gotham North",
    "OG02": "Old Gotham South",
    "OG03": "Old Gotham West",
    "CA01": "The Cauldron Central",
    "CA02": "The Cauldron South",
    "CAAC": "The Cauldron North - ACE Chemicals",
    "NT01": "Newtown",
    "GVRP": "Gotham Village - Robinson Park",
    "EEAM": "East End - Amusement Mile",
    "OT01": "Otisburg",
    "BC": "The Batcave",
}
ISLAND = {"SI": "South Island", "NI": "North Island", "CI": "Central Island",
          "TC": "Tricorner", "BC": "The Batcave"}

# Activity type display names
ACTTYPE = {
    "Heist": "Heist",
    "Zoo": "Zoo Animal",
    "Puzzle.Room": "Puzzle Room",
    "Croc": "Killer Croc",
    "Plant": "Poison Ivy Plant",
    "Photofit": "Photofit (Wanted)",
    "FastTravel": "SubWayne Station",
    "UpgradeArea": "Upgrade Area",
    "Puzzle.Riddler": "Riddler Trophy Puzzle",
    "Puzzle.Cluemaster": "Cluemaster Puzzle",
    "Exploration.WTC": "WayneTech Chip Hunt",
    "Exploration.PuzzleWTC": "WayneTech Chip Puzzle",
    "Exploration.PS": "Purple Stud Hunt",
}

def prettify(seg):
    # Insert spaces in CamelCase / split underscores
    s = seg.replace("_", " ")
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', s)
    s = re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', s)
    s = re.sub(r'(?<=[a-zA-Z])(?=[0-9])', ' ', s)
    s = re.sub(r'(?<=[0-9])(?=[A-Za-z])', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def add(tag, name, conf, source):
    out[tag] = {"name": name, "confidence": conf, "source": source}

def num(s):
    # strip leading zeros, return int-ish
    m = re.match(r'^0*(\d+)', s)
    return str(int(m.group(1))) if m else s

# ---------------- Activities (729) ----------------
for e in d["Activities"]:
    tag = e["tag"]; t = tag[len(PFX):]  # Activities....
    body = t[len("Activities."):]
    if body.startswith("Types."):
        tt = body[len("Types."):]
        name = ACTTYPE.get(tt) or prettify(tt.split(".")[-1])
        add(tag, f"Activity Type: {name}", "high", "tag")
    elif body.startswith("Instances."):
        p = body[len("Instances."):].split(".")
        # Story instances
        if p[0] == "Story":
            # Story.01.03.Photofit.00[.suffix]
            rest = ".".join(p[1:])
            add(tag, f"Story Activity {rest}", "medium", "tag")
            continue
        island = ISLAND.get(p[0], p[0])
        dist = DISTRICT.get(p[1], p[1])
        rest = p[2:]
        # find activity type tokens until numeric
        types=[]; i=0
        while i < len(rest) and not re.match(r'^\d', rest[i]):
            types.append(rest[i]); i+=1
        tkey = ".".join(types)
        tname = ACTTYPE.get(tkey) or prettify(tkey)
        n = num(rest[i]) if i < len(rest) else None
        suffix = rest[i+1:] if i < len(rest) else []
        base = f"{dist} — {tname}"
        if n is not None:
            base += f" #{n}"
        if suffix:
            sx = ".".join(suffix)
            if sx == "CompletionBadge":
                base += " (Completion)"
            elif sx.startswith("OBJ"):
                base += f" – Objective {sx[3:].lstrip('0') or sx[3:]}"
            else:
                base += f" – {prettify(sx)}"
            add(tag, base, "medium", "tag+district")
        else:
            add(tag, base, "high", "tag+district")
    elif body.startswith("EventChains."):
        ec = body[len("EventChains."):]
        # EventChains.Heists.00 / Puzzle.Room.Riddler.00 / KillerCroc.Finale
        parts = ec.split(".")
        n = parts[-1]
        cat = ".".join(parts[:-1])
        catname = {"Heists":"Heist","KillerCroc":"Killer Croc",
                   "Puzzle.Room.Riddler":"Riddler Puzzle Room",
                   "Puzzle.Room.Cluemaster":"Cluemaster Puzzle Room"}.get(cat, prettify(cat))
        label = "Finale" if n=="Finale" else f"#{num(n)}"
        add(tag, f"{catname} Chain {label}", "medium", "tag")
    elif body.startswith("Gamewide."):
        g = body[len("Gamewide."):]
        if "100Percent" in g:
            suffix = g.split(".")[-1]
            base = "100% Completion"
            if suffix.startswith("OBJ"):
                base += f" – Objective {suffix[3:]}"
            elif suffix == "CompletionBadge":
                base += " (Completion)"
            add(tag, base, "high", "tag")
        else:
            add(tag, prettify(g), "low", "tag")
    else:
        add(tag, prettify(body), "low", "tag")

# ---------------- Challenges (96) ----------------
for e in d["Challenges"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Challenges."):]
    parts = body.split(".")
    if parts[0] == "Achievements":
        add(tag, f"Achievement: {prettify(parts[-1])}", "high", "tag")
    else:
        add(tag, prettify(parts[-1]), "high", "tag")

# ---------------- Conversations (103) ----------------
PARTICIPANT_HINT = {"Croc":"Killer Croc","Flass":"Flass","Harvey":"Harvey Dent",
    "Renee":"Renee Montoya","Joker01":"Joker","Joker02":"Joker","Joker03":"Joker",
    "Ringmaster":"Ringmaster","LuciusFoxA":"Lucius Fox","PoliceOfficer":"Police Officer",
    "ZooKeeper02":"Zookeeper","EndConvo":"Ending","Scientist_01":"Scientist"}
for e in d["Conversations"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Conversations."):]
    parts = body.split(".")
    # strip trailing technical tokens
    tech = re.compile(r'^(ACTION_|SEQACTIONGROUP_|CONVERSATION_)', re.I)
    techsuffix = ""
    core = parts[:]
    while core and tech.match(core[-1]):
        techsuffix = "." + ".".join(parts[len(core)-1:]) if not techsuffix else techsuffix
        core = core[:-1]
    if parts[0] == "Story":
        # Story.05.01.Joker01[.ACTION]
        who = None
        for seg in reversed(core):
            if not re.match(r'^\d', seg):
                who = seg; break
        chap = ".".join([s for s in core[1:3]])
        wname = PARTICIPANT_HINT.get(who, prettify(who) if who else "")
        nm = f"Story Convo {chap}: {wname}".strip()
        conf = "medium"
        src = "tag"
    elif parts[0] == "IcebergLounge":
        nm = f"Iceberg Lounge: {prettify(core[-1])}"
        conf="medium"; src="tag"
    elif parts[0] == "Hub":
        # Hub.<type or island>...
        # detect island/district
        isl = None; dist = None
        for i,seg in enumerate(parts):
            if seg in ISLAND and isl is None: isl=seg; isl_i=i
            if seg in DISTRICT and dist is None: dist=seg
        loc = DISTRICT.get(dist, ISLAND.get(isl, "")) if (dist or isl) else ""
        # activity-type-ish second token
        ttok = parts[1]
        ttok_name = {"Photofit":"Photofit","FastTravel":"SubWayne","Heist":"Heist",
            "KillerCroc":"Killer Croc","Exploration":"Exploration","Zoo":"Zoo"}.get(ttok)
        # if second token is an island, the type comes after district
        if ttok in ISLAND:
            # Hub.SI.OG03.Zoo.01...
            rem = [s for s in core[3:] if not re.match(r'^(ACTION|SEQ)',s,re.I)]
            ttok_name = prettify(rem[0]) if rem else "Conversation"
        label = ttok_name or prettify(ttok)
        nm = (f"{loc} — {label} Conversation" if loc else f"{label} Conversation").strip()
        conf="medium"; src="tag+district"
    else:
        nm = prettify(body); conf="low"; src="tag"
    if techsuffix:
        nm += " (cont.)"
        conf = "low"
    add(tag, nm, conf, src)

# ---------------- Tutorials (306) ----------------
for e in d["Tutorials"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Tutorials."):]
    parts = body.split(".")
    cat = prettify(parts[0]) if len(parts)>1 else ""
    name = prettify(parts[-1])
    nm = f"Tutorial: {name}" + (f" ({cat})" if cat else "")
    add(tag, nm, "high", "tag")

# ---------------- RandomCrimes (31) ----------------
for e in d["RandomCrimes"]:
    tag = e["tag"]; body = tag[len(PFX):][len("RandomCrimes."):]
    parts = body.split(".")
    # RandomCrimes.UnlockConditions.Archetypes.Pistol etc
    cat = parts[-2] if len(parts)>=2 else ""
    catname = {"Archetypes":"Enemy Archetype","Faction":"Faction","Type":"Crime Type"}.get(cat, prettify(cat))
    nm = f"Random Crime – {catname}: {prettify(parts[-1])}"
    add(tag, nm, "high", "tag")

# ---------------- Crimes (13) ----------------
for e in d["Crimes"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Crimes."):]
    parts = body.split(".")
    # Crimes.Missions.PurseSnatcher.CompletionBadge
    core = [p for p in parts if p not in ("Missions","CompletionBadge")]
    nm = "Crime: " + prettify(".".join(core))
    add(tag, nm, "high", "tag")

# ---------------- DiscoveryTowers (9) ----------------
for e in d["DiscoveryTowers"]:
    tag = e["tag"]; body = tag[len(PFX):][len("DiscoveryTowers."):]
    parts = body.split(".")
    # DiscoveryTowers.Hub.TC.TC01.DiscoveryTower.00TOW  OR  Hub.SI.CA01...
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, "?")
    add(tag, f"{loc} — Discovery Tower", "high", "tag+district")

# ---------------- FastTravel (10) ----------------
for e in d["FastTravel"]:
    tag = e["tag"]; body = tag[len(PFX):][len("FastTravel."):]
    parts = body.split(".")
    if parts[0]=="Batcave":
        add(tag, "SubWayne: The Batcave", "high", "tag"); continue
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, "?")
    add(tag, f"SubWayne Station: {loc}", "high", "tag+district")

# ---------------- FastTravelUnlock (9) ----------------
for e in d["FastTravelUnlock"]:
    tag = e["tag"]; body = tag[len(PFX):][len("FastTravelUnlock."):]
    parts = body.split(".")
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, "?")
    add(tag, f"SubWayne Unlock: {loc}", "high", "tag+district")

# ---------------- ARVRTraining (32) ----------------
RAC = {"00RAC":"Combat","01RAC":"Combat","02RAC":"On-Foot Race","03RAC":"Vehicle Race",
       "04RAC":"Vehicle Race","05RAC":"On-Foot Race","06RAC":"On-Foot Race"}
for e in d["ARVRTraining"]:
    tag = e["tag"]; body = tag[len(PFX):][len("ARVRTraining."):]
    parts = body.split(".")
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, "?")
    rac = parts[-1]
    racn = num(rac.replace("RAC",""))
    add(tag, f"{loc} — AR/VR Training #{racn}", "medium", "tag+district")

# ---------------- Islands (4) ----------------
for e in d["Islands"]:
    tag = e["tag"]; code = tag[len(PFX):][len("Islands."):]
    add(tag, ISLAND.get(code, prettify(code)), "high", "tag")

# ---------------- Batcave (13) ----------------
BC_NAMES = {"BatComputer":"Bat-Computer","CircleExpansion":"Circle Expansion",
    "CaveExpansion":"Cave Expansion","DLCArea":"DLC Area","TrophyExpansion":"Trophy Expansion",
    "WaterFallExpansion":"Waterfall Expansion","ScienceLab":"Science Lab",
    "TrainingRoom":"Training Room","Batcave66":"Batcave '66","100Complete":"100% Complete",
    "TrexTrophy":"T-Rex Trophy"}
for e in d["Batcave"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Batcave."):]
    parts = body.split(".")
    last = parts[-1]
    if parts[0]=="Batphone":
        add(tag, f"Batcave: Batphone {prettify(last)}", "high", "tag"); continue
    nm = BC_NAMES.get(last, prettify(last))
    prefix = "Batcave Platform: " if parts[0]=="BatcavePlatforms" else "Batcave: "
    add(tag, prefix+nm, "high", "tag")

# ---------------- Shops (11) ----------------
for e in d["Shops"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Shops."):]
    parts = body.split(".")
    if parts[0]=="Batcave": add(tag,"Shop: The Batcave","high","tag"); continue
    if parts[0]=="Gotham": add(tag,"Shop: Gotham City","high","tag"); continue
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, prettify(parts[-1]))
    add(tag, f"Shop: {loc}", "high", "tag+district")

# ---------------- GadgetBench (5) ----------------
for e in d["GadgetBench"]:
    tag = e["tag"]; body = tag[len(PFX):][len("GadgetBench."):]
    parts = body.split(".")
    last = parts[-1]
    loc = ISLAND.get(last, {"BC":"The Batcave"}.get(last, prettify(last)))
    add(tag, f"Gadget Bench: {loc}", "high", "tag")

# ---------------- BrutalBat (4) ----------------
for e in d["BrutalBat"]:
    tag = e["tag"]; body = tag[len(PFX):][len("BrutalBat."):]
    add(tag, f"Brutal Bat ({prettify(body)})", "high", "tag")

# ---------------- Eras (3) ----------------
ERAS = {"LowHighResEras":"Era Resolution State","CurrentStoryBeat":"Current Story Beat",
        "CurrentEra":"Current Era"}
for e in d["Eras"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Eras."):]
    add(tag, ERAS.get(body, prettify(body)), "high", "tag")

# ---------------- GameMenu (2) ----------------
for e in d["GameMenu"]:
    tag = e["tag"]; body = tag[len(PFX):][len("GameMenu."):]
    add(tag, f"Game Menu: {prettify(body)} Unlocked", "high", "tag")

# ---------------- RoadClosures (1) ----------------
for e in d["RoadClosures"]:
    tag = e["tag"]; body = tag[len(PFX):][len("RoadClosures."):]
    # RoadClosures.Hub.Bridges.TCSI
    last = body.split(".")[-1]
    # TCSI = Tricorner <-> South Island bridge
    nm = "Road Closure: Tricorner–South Island Bridge" if last=="TCSI" else f"Road Closure: {prettify(last)}"
    add(tag, nm, "medium", "tag")

# ---------------- LeavingAreaSplines (1) ----------------
for e in d["LeavingAreaSplines"]:
    tag = e["tag"]; body = tag[len(PFX):][len("LeavingAreaSplines."):]
    add(tag, f"Leaving-Area Spline: {prettify(body)}", "medium", "tag")

# ---------------- BatSignal (1) ----------------
for e in d["BatSignal"]:
    tag = e["tag"]; body = tag[len(PFX):][len("BatSignal."):]
    add(tag, "Current Bat-Signal Progress", "high", "tag")

# ---------------- Gifts (1) ----------------
for e in d["Gifts"]:
    tag = e["tag"]; body = tag[len(PFX):][len("Gifts."):]
    nm = "Gift: NPS Cache" if body=="NPSCache" else f"Gift: {prettify(body)}"
    add(tag, nm, "medium", "tag")

# ---------------- StaticTraversal (10) ----------------
for e in d["StaticTraversal"]:
    tag = e["tag"]; body = tag[len(PFX):][len("StaticTraversal."):]
    parts = body.split(".")
    if body=="TetherPoints":
        add(tag, "Tether Points (global)", "high", "tag"); continue
    dist=None
    for seg in parts:
        if seg in DISTRICT: dist=seg
    loc = DISTRICT.get(dist, "?")
    add(tag, f"Tether Points: {loc}", "high", "tag+district")

# ---------------- LoadingScreen (37) ----------------
for e in d["LoadingScreen"]:
    tag = e["tag"]; body = tag[len(PFX):][len("LoadingScreen."):]
    # LoadingScreen.Hints.Tut28_StealthTakedown
    last = body.split(".")[-1]
    last = re.sub(r'^Tut\d+_', '', last)
    add(tag, f"Loading Hint: {prettify(last)}", "high", "tag")

json.dump(out, open('/tmp/ttx_names_misc.json','w'), indent=1, ensure_ascii=False)

# ---- Summary ----
from collections import Counter, defaultdict
percat = defaultdict(Counter)
for e in d:
    pass
# map each output tag back to category
catof = {}
for cat in MINE:
    for e in d[cat]:
        catof[e["tag"]] = cat
total = len(out)
percat_conf = defaultdict(Counter)
for tag, v in out.items():
    cat = catof.get(tag, "?")
    percat_conf[cat][v["confidence"]] += 1
print(f"TOTAL named: {total}")
for cat in MINE:
    c = percat_conf[cat]
    got = sum(c.values()); tot = len(d[cat])
    print(f"  {cat:20s} {got}/{tot}  " + " ".join(f"{k}={v}" for k,v in sorted(c.items())))
EOF_MARK = True
print("\nDISTRICT MAP:")
for k,v in DISTRICT.items(): print(f"  {k} -> {v}")
print("ISLANDS:", ISLAND)
