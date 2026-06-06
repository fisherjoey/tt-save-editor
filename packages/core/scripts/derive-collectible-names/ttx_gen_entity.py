#!/usr/bin/env python3
import json, re

d = json.load(open('/tmp/ttx_targets.json'))
MINE = ['Characters','Vehicles','ShopItems','Skills','Gadgets','MechanicUnlocks']

# Acronyms / special tokens that should keep specific casing/spelling
SPECIAL = {
    'TAS': 'Animated Series',          # The Animated Series
    'TtOriginal': 'TT Original',
    'TTOriginal': 'TT Original',
    'DC27': 'DC #27',                  # Detective Comics #27
    'DC411': 'DC #411',
    'NES': 'NES',
    'POP': 'POP',
    'LEGO08': 'LEGO 2008',
    'LEGO2025': 'LEGO 2025',
    'LEGOBatmanMovie': 'LEGO Batman Movie',
    'New52': 'New 52',
    'New52Original': 'New 52 Original',
    'DCBombshells': 'DC Bombshells',
    'BraveAndTheBold': 'Brave and the Bold',
    'AndRobin': 'and Robin',
    'BatmanAndRobin': 'Batman and Robin',
    'ZurEnArrh': 'Zur-En-Arrh',
    'GothamByGaslight': 'Gotham by Gaslight',
    'DarkKnightReturns': 'Dark Knight Returns',
    'DarkKnightRises': 'Dark Knight Rises',
    'DarkKnightsOfSteel': 'Dark Knights of Steel',
    'MaskOfTengu': 'Mask of the Tengu',
    'MerryLittle': 'Merry Little Batman',
    'MerryLittleBatman': 'Merry Little Batman',
    'One2025': 'Batman: One',
    'BatmanOne': 'Batman: One',
    'TheBatman2025': 'The Batman (2025)',
    'JusticeLeague': 'Justice League',
    'GreyGhost': 'Grey Ghost',
    'TASGrey': 'Animated Series (Grey)',
    'IceSuit': 'Ice Suit',
    'Icesuit': 'Ice Suit',
    'ZeroYear': 'Zero Year',
    'FinalBoss': 'Final Boss',
    'RaverGoth': 'Raver Goth',
    'CostumeParty': 'Costume Party',
    'GordonCop': 'Cop',
    'RobinDickGrayson': 'Dick Grayson',
    'NightwingYearOne': 'Year One',
    'SpyralAgent': 'Spyral Agent',
    'BronzeAge': 'Bronze Age',
    'TheCatWoman': 'The Catwoman',
    'CatwomanBatmanReturns': 'Batman Returns',
    'Catwoman1966': '1966',
    'PostCrisis': 'Post-Crisis',
    'WorldsFinest': "World's Finest",
    'TeenTitansGo': 'Teen Titans Go!',
    'ClassicFieldAgent': 'Classic Field Agent',
    'GreenLeague': 'Green League',
    'ShadowWar': 'Shadow War',
    'PunkRock': 'Punk Rock',
    'BatmanBeyond': 'Beyond',
    'KittyCarModern': 'Kitty Car (Modern)',
    'KittyCar1966': 'Kitty Car (1966)',
    'CatwomanBike': 'Catwoman Bike',
    'CatwomanBike2022': 'Catwoman Bike (2022)',
    'ScooterBarbara': 'Barbara Scooter',
    'Scooter_Barbara': 'Barbara Scooter',
    'SwatVan': 'SWAT Van',
    'DJBooth': 'DJ Booth',
    'TvCamera': 'TV Camera',
    'LivingRoomTV': 'Living Room TV',
    'ATM': 'ATM',
    'UFO': 'UFO',
    'AOEDart': 'AOE Dart',
    'TtOriginal': 'TT Original',
    'BatTech': 'BatTech',
    'WallBatTech': 'BatTech Wall',
    'FenceBatTech': 'BatTech Fence',
    'GentlemanGhostSign': 'Gentleman Ghost Sign',
    'KnockOn': 'Knock-On',
    'HyperCombo': 'Hyper Combo',
    'HyperCombo2': 'Hyper Combo II',
    'StudMagnet': 'Stud Magnet',
    'StudMagnet2': 'Stud Magnet II',
    'ExtraFocus': 'Extra Focus',
    'ExtraFocus2': 'Extra Focus II',
    'HealthyHero': 'Healthy Hero',
    'HealthyHero2': 'Healthy Hero II',
    'SneakandSmash': 'Sneak and Smash',
    'Tt': 'TT',
    'BatmanVsSuperman': 'Batman v Superman',
    'BatmanForever': 'Batman Forever',
    'BatmanAndRobin': 'Batman & Robin',
    'MonsterTruck': 'Monster Truck',
    'NumberOfBatarangs': 'Number of Batarangs',
    'GlideTakeDown': 'Glide Takedown',
    'AnalysisDetector': 'Analysis Detector',
    'StudComboDuration': 'Stud Combo Duration',
    'StudComboSpeed': 'Stud Combo Speed',
}

# Owner display names
OWNER = {
    'Batman':'Batman','Gordon':'Gordon','Catwoman':'Catwoman','Robin':'Robin',
    'Batgirl':'Batgirl','Nightwing':'Nightwing','Talia':'Talia',
    'RobinDickGrayson':'Robin','TaliaAlGhul':'Talia','VehicleGadgets':'Vehicle',
}

def split_camel(s):
    # insert spaces: handle digits and camelCase, keep acronym runs
    s = s.replace('_', ' ')
    # split between lower/digit and Upper
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', s)
    # split between Upper-run and Upper+lower (e.g. DCBombshells -> DC Bombshells)
    s = re.sub(r'(?<=[A-Z])(?=[A-Z][a-z])', ' ', s)
    # split letter/digit boundaries
    s = re.sub(r'(?<=[A-Za-z])(?=[0-9])', ' ', s)
    s = re.sub(r'(?<=[0-9])(?=[A-Za-z])', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def pretty(token):
    if token in SPECIAL:
        return SPECIAL[token]
    return split_camel(token)

out = {}

def add(tag, name, conf, src):
    out[tag] = {"name": name, "confidence": conf, "source": src}

# ---- Characters: Definitions.Characters.<Owner>.<Variant> -> "<Variant> (<Owner>)"
for item in d['Characters']:
    tag = item['tag']
    parts = tag.split('.')
    owner = parts[3]
    variant = parts[4]
    od = OWNER.get(owner, owner)
    vn = pretty(variant)
    # If variant already equals owner name (e.g. Gordon.Gordon, Catwoman.Catwoman), just use owner + "Classic"
    if vn.lower() == od.lower():
        name = f"{od} (Classic)"
    else:
        name = f"{vn} ({od})"
    add(tag, name, "high", "tag")

# ---- Vehicles: Definitions.Vehicles.<Owner>.<Name>
for item in d['Vehicles']:
    tag = item['tag']
    parts = tag.split('.')
    owner = parts[3]
    name_tok = parts[4]
    nm = pretty(name_tok)
    # Reorder Batmobile<year>_<film> patterns: e.g. Batmobile1989 -> "1989 Batmobile"; Batmobile_ArkhamKnight -> "Arkham Knight Batmobile"
    m = re.match(r'^Batmobile(\d{4})?_?(.*)$', name_tok)
    if name_tok.startswith('Batmobile'):
        # extract year and suffix
        ym = re.search(r'(\d{4})', name_tok)
        suffix = re.sub(r'^Batmobile', '', name_tok)
        suffix = re.sub(r'\d{4}', '', suffix).strip('_')
        suf = pretty(suffix) if suffix else ''
        year = ym.group(1) if ym else ''
        bits = [b for b in [suf, year] if b]
        if bits:
            nm = f"{' '.join(bits)} Batmobile"
        else:
            nm = "Batmobile"
    elif name_tok.startswith('Batcycle') or name_tok.startswith('Batbike') or name_tok.startswith('Batpod'):
        ym = re.search(r'(\d{4})', name_tok)
        base = re.sub(r'\d{4}.*$', '', name_tok)
        base = re.sub(r'_.*$', '', base)
        base_p = pretty(base)
        year = ym.group(1) if ym else ''
        nm = f"{base_p} {year}".strip() if year else base_p
    add(tag, nm, "high", "tag")

# ---- ShopItems: many subtypes
# Definitions.ShopItems.<Type>.<...>.<Name>
# Type in {Vehicles, Props, Suits, DLC?} plus a few flat status tags
FLAT_SHOP = {
    'GameProgress.Definitions.ShopItems.TutorialItemPurchased': 'Tutorial Item Purchased',
    'GameProgress.Definitions.ShopItems.OutOfStockPurchasedAllItems': 'Out of Stock (All Items Purchased)',
    'GameProgress.Definitions.ShopItems.OutOfStock': 'Out of Stock',
    'GameProgress.Definitions.ShopItems.NewItemsAvailable': 'New Items Available',
}
for item in d['ShopItems']:
    tag = item['tag']
    if tag in FLAT_SHOP:
        add(tag, FLAT_SHOP[tag], "high", "tag")
        continue
    parts = tag.split('.')
    # parts[2]=ShopItems, parts[3]=Type
    typ = parts[3]
    last = parts[-1]
    nm = pretty(last)
    conf = "high"
    if typ == 'Vehicles':
        owner = parts[4]
        # vehicle shop item: prettify name, reorder Batmobile years
        nt = last
        if nt.startswith('Batmobile'):
            ym = re.search(r'(\d{4})', nt)
            suffix = re.sub(r'^Batmobile','',nt); suffix = re.sub(r'\d{4}','',suffix).strip('_')
            suf = pretty(suffix) if suffix else ''
            year = ym.group(1) if ym else ''
            bits=[b for b in [suf,year] if b]
            nm = (f"{' '.join(bits)} Batmobile" if bits else "Batmobile")
        elif nt.startswith('Batcycle') or nt.startswith('Batbike'):
            ym=re.search(r'(\d{4})',nt); base=re.sub(r'\d{4}.*$','',nt); base=re.sub(r'_.*$','',base)
            year=ym.group(1) if ym else ''
            nm=f"{pretty(base)} {year}".strip()
        nm = f"{nm} (Vehicle)"
    elif typ == 'Suits':
        owner = parts[4]
        od = OWNER.get(owner, owner)
        vn = pretty(last)
        if vn.lower()==od.lower():
            nm = f"{od} Suit (Classic)"
        else:
            nm = f"{vn} Suit ({od})"
    elif typ == 'Props':
        # Props.<Region>.<...>.<Name>  -> "<Name> (<Region/Level>)"
        # region path between Props and last
        region = None
        sub = parts[4:-1]  # e.g. ['Levels','Nanda'] or ['Batcave'] or ['Gotham','Interior']
        # build a readable location
        if sub:
            # use the most specific meaningful location token
            if sub[0] == 'Levels' and len(sub) >= 2:
                region = pretty(sub[1])
            elif sub[0] in ('Gotham',):
                region = 'Gotham ' + (pretty(sub[1]) if len(sub)>1 else '')
                region = region.strip()
            elif sub[0] == 'DLC' and len(sub) >= 2:
                region = pretty(sub[1])
            else:
                region = pretty(sub[0])
        nm = pretty(last)
        if region:
            nm = f"{nm} ({region})"
        conf = "med"  # prop names are heuristic
    else:
        nm = pretty(last)
        conf = "med"
    add(tag, nm, conf, "tag")

# ---- Skills: Definitions.Skills[.Shared].<Group>.<Name>  -> prettify trailing
for item in d['Skills']:
    tag = item['tag']
    parts = tag.split('.')
    last = parts[-1]
    nm = pretty(last)
    add(tag, nm, "high", "tag")

# ---- Gadgets: Definitions.Gadgets.<Owner>.<Gadget>.<Upgrade>  (or VehicleGadgets.<x>)
for item in d['Gadgets']:
    tag = item['tag']
    parts = tag.split('.')
    last = parts[-1]
    nm = pretty(last)
    # context: owner + gadget
    owner = parts[3]
    if owner == 'VehicleGadgets':
        nm = f"{pretty(last)} (Vehicle Gadget)"
        add(tag, nm, "high", "tag"); continue
    gadget = parts[4] if len(parts) > 5 else None
    od = OWNER.get(owner, pretty(owner))
    if gadget:
        nm = f"{pretty(last)} ({od} {pretty(gadget)})"
    else:
        nm = f"{pretty(last)} ({od})"
    add(tag, nm, "high", "tag")

# ---- MechanicUnlocks: Definitions.MechanicUnlocks.<Name>
MECH_SPECIAL = {
    'RubberBulletLauncher':'Rubber Bullet Launcher',
    'ElectricTetherLauncher':'Electric Tether Launcher',
}
for item in d['MechanicUnlocks']:
    tag = item['tag']
    last = tag.split('.')[-1]
    nm = MECH_SPECIAL.get(last, pretty(last))
    add(tag, nm, "high", "tag")

json.dump(out, open('/tmp/ttx_names_entity.json','w'), indent=1, ensure_ascii=False)

# stats
from collections import Counter
cats = {
 'Characters': [i['tag'] for i in d['Characters']],
 'Vehicles': [i['tag'] for i in d['Vehicles']],
 'ShopItems': [i['tag'] for i in d['ShopItems']],
 'Skills': [i['tag'] for i in d['Skills']],
 'Gadgets': [i['tag'] for i in d['Gadgets']],
 'MechanicUnlocks': [i['tag'] for i in d['MechanicUnlocks']],
}
total=0
for c, tags in cats.items():
    conf = Counter(out[t]['confidence'] for t in tags)
    named = sum(1 for t in tags if t in out)
    total += named
    print(f"{c}: named {named}/{len(tags)}  conf={dict(conf)}")
print("TOTAL named:", total, "of", sum(len(v) for v in cats.values()))
