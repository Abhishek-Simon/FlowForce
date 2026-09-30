# Original YOLO model IDs
MODEL_CLASSES = {
    0: "ambulance",
    1: "auto rickshaw",
    2: "bicycle",
    3: "bus",
    4: "car",
    5: "minivan",
    6: "motorbike",
    7: "pickup",
    8: "rickshaw",
    9: "suv",
    10: "three wheelers (CNG)",
    11: "truck",
    12: "van",
    13: "tractor",
}

# Final application UI classes
UI_CLASSES = {
    0: "ambulance",
    1: "three wheeler",
    2: "bus",
    3: "car",
    4: "motorbike",
    5: "truck",
    6: "tractor",
    7: "bicycle",
}

# Original YOLO ID -> final UI ID
# Mapping all 4-wheeler passenger vehicle categories (SUV, minivan, pickup, van) to 'car'
MODEL_TO_UI = {
    0: 0,    # ambulance -> ambulance
    1: 1,    # auto rickshaw -> three wheeler
    8: 1,    # rickshaw -> three wheeler
    10: 1,   # CNG -> three wheeler
    3: 2,    # bus -> bus
    4: 3,    # car -> car
    5: 3,    # minivan -> car
    7: 3,    # pickup -> car
    9: 3,    # suv -> car (Skoda, Creta, Fortuner, etc.)
    12: 3,   # van -> car
    6: 4,    # motorbike -> motorbike
    11: 5,   # truck -> truck
    13: 6,   # tractor -> tractor
    2: 7,    # bicycle -> bicycle
}

# All original model IDs are allowed
ALLOWED_MODEL_IDS = set(MODEL_TO_UI.keys())
REMOVED_CLASSES = {}
