from pathlib import Path
import shutil
import random
import xml.etree.ElementTree as ET
from collections import Counter


# ============================================================
# PATHS
# ============================================================

BASE = Path(
    r"C:\Users\Arpit\Downloads\traffic-ml-service_1\traffic-ml"
)

OUTPUT = BASE / "FINAL_TRAFFIC_DATASET"

SOURCES = {
    "dhaka": BASE / "DhakaAI_YOLO",
    "indian": Path(r"C:\Users\Arpit\Downloads\Indian_vehicle_dataset"),
    "auto": Path(r"C:\Users\Arpit\Downloads\auto"),
    "small": Path(r"C:\Users\Arpit\Downloads\small vehicle"),
    "construction": Path(r"C:\Users\Arpit\Downloads\contruction"),
    "ambulance": Path(r"C:\Users\Arpit\Downloads\ambulance"),
}


# ============================================================
# FINAL 14 CLASSES
# ============================================================

CLASS_NAMES = [
    "ambulance",
    "auto rickshaw",
    "bicycle",
    "bus",
    "car",
    "minivan",
    "motorbike",
    "pickup",
    "rickshaw",
    "suv",
    "three wheelers (CNG)",
    "truck",
    "van",
    "tractor",
]


# ============================================================
# DHAKAAI: OLD CLASS ID → NEW CLASS ID
# None = REMOVE
# ============================================================

DHAKAAI_MAPPING = {
    0: 0,       # ambulance
    1: None,    # army vehicle
    2: 1,       # auto rickshaw
    3: 2,       # bicycle
    4: 3,       # bus
    5: 4,       # car
    6: None,    # garbagevan
    7: None,    # human hauler
    8: None,    # minibus
    9: 5,       # minivan
    10: 6,      # motorbike
    11: 7,      # pickup
    12: None,   # policecar
    13: 8,      # rickshaw
    14: None,   # scooter
    15: 9,      # suv
    16: None,   # taxi
    17: 10,     # three wheelers CNG
    18: 11,     # truck
    19: 12,     # van
    20: None,   # wheelbarrow
}


# ============================================================
# VOC CLASS MAPPINGS
# ============================================================

INDIAN_MAPPING = {
    "auto": 1,
    "autorickshaw": 1,

    "bicycle": 2,

    "bus": 3,

    "car": 4,

    "vehicle_truck": 11,
    "truck": 11,

    "two_wheelers": 6,
    "bike": 6,

    "van": 12,
    "pickup": 7,

    "tractor": 13,
}


AUTO_MAPPING = {
    "auto": 1,
    "autorickshaw": 1,
}


SMALL_MAPPING = {
    "auto": 1,
    "bus": 3,
    "tractor": 13,
    "truck": 11,
    "van": 12,
    "bike": 6,
    "car": 4,
}


CONSTRUCTION_MAPPING = {
    "truck": 11,
    "tractor": 13,
}


# ============================================================
# AMBULANCE
# ============================================================

AMBULANCE_CLASS_ID = 0

# Maximum number of ambulance images to use.
# We don't want 4,900 ambulance images to dominate.
MAX_AMBULANCE_IMAGES = 1500


# ============================================================
# OUTPUT SETUP
# ============================================================

for split in ["train", "val"]:

    (OUTPUT / "images" / split).mkdir(
        parents=True,
        exist_ok=True
    )

    (OUTPUT / "labels" / split).mkdir(
        parents=True,
        exist_ok=True
    )


# ============================================================
# STATISTICS
# ============================================================

final_object_counts = Counter()
final_image_counts = Counter()

source_object_counts = {}
source_image_counts = {}

file_counter = 0


# ============================================================
# SAVE IMAGE + LABEL
# ============================================================

def save_pair(
    image_path,
    labels,
    source,
    split
):

    global file_counter

    if not labels:
        return

    file_counter += 1

    new_stem = (
        f"{source}_{file_counter:07d}_"
        f"{image_path.stem}"
    )

    image_destination = (
        OUTPUT /
        "images" /
        split /
        (new_stem + image_path.suffix.lower())
    )

    label_destination = (
        OUTPUT /
        "labels" /
        split /
        (new_stem + ".txt")
    )

    shutil.copy2(
        image_path,
        image_destination
    )

    with open(
        label_destination,
        "w",
        encoding="utf-8"
    ) as f:

        for class_id, xc, yc, w, h in labels:

            f.write(
                f"{class_id} "
                f"{xc:.6f} "
                f"{yc:.6f} "
                f"{w:.6f} "
                f"{h:.6f}\n"
            )

            final_object_counts[class_id] += 1

        for class_id in set(
            x[0] for x in labels
        ):
            final_image_counts[class_id] += 1


# ============================================================
# FIND IMAGE BY STEM
# ============================================================

def build_image_lookup(root):

    lookup = {}

    for path in root.rglob("*"):

        if not path.is_file():
            continue

        if path.suffix.lower() not in [
            ".jpg",
            ".jpeg",
            ".png",
        ]:
            continue

        lookup[path.stem.lower()] = path

    return lookup


# ============================================================
# VOC XML → YOLO
# ============================================================

def xml_to_yolo(
    xml_path,
    mapping
):

    try:
        root = ET.parse(
            xml_path
        ).getroot()
    except Exception as e:

        print(
            f"ERROR XML: {xml_path}"
        )
        print(e)

        return []

    size = root.find("size")

    if size is None:
        return []

    width_node = size.find("width")
    height_node = size.find("height")

    if width_node is None or height_node is None:
        return []

    width = float(width_node.text)
    height = float(height_node.text)

    labels = []

    for obj in root.findall("object"):

        name_node = obj.find("name")

        if name_node is None:
            continue

        name = (
            name_node.text
            .strip()
            .lower()
        )

        if name not in mapping:
            continue

        new_class = mapping[name]

        if new_class is None:
            continue

        bbox = obj.find("bndbox")

        if bbox is None:
            continue

        try:

            xmin = float(
                bbox.find("xmin").text
            )

            ymin = float(
                bbox.find("ymin").text
            )

            xmax = float(
                bbox.find("xmax").text
            )

            ymax = float(
                bbox.find("ymax").text
            )

        except Exception:
            continue

        xmin = max(
            0,
            min(xmin, width)
        )

        xmax = max(
            0,
            min(xmax, width)
        )

        ymin = max(
            0,
            min(ymin, height)
        )

        ymax = max(
            0,
            min(ymax, height)
        )

        if xmax <= xmin:
            continue

        if ymax <= ymin:
            continue

        xc = (
            (xmin + xmax) / 2
        ) / width

        yc = (
            (ymin + ymax) / 2
        ) / height

        w = (
            xmax - xmin
        ) / width

        h = (
            ymax - ymin
        ) / height

        labels.append(
            (
                new_class,
                xc,
                yc,
                w,
                h
            )
        )

    return labels


# ============================================================
# DHAKAAI
# ============================================================

def process_dhakaai():

    print("\n" + "=" * 70)
    print("PROCESSING DHAKAAI")
    print("=" * 70)

    root = SOURCES["dhaka"]

    image_root = root / "images"
    label_root = root / "labels"

    image_lookup = build_image_lookup(
        image_root
    )

    label_files = list(
        label_root.rglob("*.txt")
    )

    print(
        f"DhakaAI label files: "
        f"{len(label_files)}"
    )

    pairs = []

    for label_path in label_files:

        image_path = image_lookup.get(
            label_path.stem.lower()
        )

        if image_path is None:
            continue

        labels = []

        try:

            with open(
                label_path,
                "r",
                encoding="utf-8"
            ) as f:

                for line in f:

                    parts = (
                        line.strip()
                        .split()
                    )

                    if len(parts) != 5:
                        continue

                    old_class = int(
                        parts[0]
                    )

                    if old_class not in DHAKAAI_MAPPING:
                        continue

                    new_class = (
                        DHAKAAI_MAPPING[
                            old_class
                        ]
                    )

                    if new_class is None:
                        continue

                    xc, yc, w, h = map(
                        float,
                        parts[1:]
                    )

                    labels.append(
                        (
                            new_class,
                            xc,
                            yc,
                            w,
                            h
                        )
                    )

        except Exception as e:

            print(
                f"ERROR: {label_path}"
            )

            print(e)

            continue

        if labels:
            pairs.append(
                (
                    image_path,
                    labels
                )
            )

    random.shuffle(pairs)

    split_index = int(
        len(pairs) * 0.8
    )

    train_pairs = pairs[
        :split_index
    ]

    val_pairs = pairs[
        split_index:
    ]

    for split, subset in [
        ("train", train_pairs),
        ("val", val_pairs)
    ]:

        for image_path, labels in subset:

            save_pair(
                image_path,
                labels,
                "dhaka",
                split
            )

    print(
        f"DhakaAI usable images: "
        f"{len(pairs)}"
    )

    print(
        f"Train: {len(train_pairs)}"
    )

    print(
        f"Val: {len(val_pairs)}"
    )


# ============================================================
# VOC DATASET
# ============================================================

def process_voc(
    source_name,
    mapping
):

    print("\n" + "=" * 70)
    print(
        f"PROCESSING {source_name.upper()}"
    )
    print("=" * 70)

    root = SOURCES[source_name]

    image_lookup = build_image_lookup(
        root
    )

    xml_files = list(
        root.rglob("*.xml")
    )

    print(
        f"XML files: "
        f"{len(xml_files)}"
    )

    pairs = []

    missing_images = 0

    for xml_path in xml_files:

        image_path = image_lookup.get(
            xml_path.stem.lower()
        )

        if image_path is None:

            missing_images += 1

            continue

        labels = xml_to_yolo(
            xml_path,
            mapping
        )

        if not labels:
            continue

        pairs.append(
            (
                image_path,
                labels
            )
        )

    random.shuffle(pairs)

    split_index = int(
        len(pairs) * 0.8
    )

    train_pairs = pairs[
        :split_index
    ]

    val_pairs = pairs[
        split_index:
    ]

    for split, subset in [
        ("train", train_pairs),
        ("val", val_pairs)
    ]:

        for image_path, labels in subset:

            save_pair(
                image_path,
                labels,
                source_name,
                split
            )

    print(
        f"Usable images: "
        f"{len(pairs)}"
    )

    print(
        f"Missing images: "
        f"{missing_images}"
    )

    print(
        f"Train: {len(train_pairs)}"
    )

    print(
        f"Val: {len(val_pairs)}"
    )


# ============================================================
# AMBULANCE
# ============================================================

def process_ambulance():

    print("\n" + "=" * 70)
    print("PROCESSING AMBULANCE")
    print("=" * 70)

    root = SOURCES["ambulance"]

    pairs = []

    for split_name in [
        "train",
        "valid"
    ]:

        image_dir = (
            root /
            split_name /
            "images"
        )

        label_dir = (
            root /
            split_name /
            "labels"
        )

        if not image_dir.exists():
            continue

        for image_path in image_dir.iterdir():

            if image_path.suffix.lower() not in [
                ".jpg",
                ".jpeg",
                ".png"
            ]:
                continue

            label_path = (
                label_dir /
                (
                    image_path.stem +
                    ".txt"
                )
            )

            if not label_path.exists():
                continue

            pairs.append(
                (
                    image_path,
                    label_path
                )
            )

    print(
        f"Available ambulance images: "
        f"{len(pairs)}"
    )

    random.shuffle(pairs)

    # Limit ambulance images
    pairs = pairs[
        :MAX_AMBULANCE_IMAGES
    ]

    print(
        f"Using ambulance images: "
        f"{len(pairs)}"
    )

    # 80/20 split
    split_index = int(
        len(pairs) * 0.8
    )

    train_pairs = pairs[
        :split_index
    ]

    val_pairs = pairs[
        split_index:
    ]

    for split, subset in [
        ("train", train_pairs),
        ("val", val_pairs)
    ]:

        for image_path, label_path in subset:

            labels = []

            with open(
                label_path,
                "r",
                encoding="utf-8"
            ) as f:

                for line in f:

                    parts = (
                        line.strip()
                        .split()
                    )

                    if len(parts) != 5:
                        continue

                    old_class = int(
                        parts[0]
                    )

                    if old_class != 0:
                        continue

                    xc, yc, w, h = map(
                        float,
                        parts[1:]
                    )

                    labels.append(
                        (
                            0,
                            xc,
                            yc,
                            w,
                            h
                        )
                    )

            if labels:

                save_pair(
                    image_path,
                    labels,
                    "ambulance",
                    split
                )

    print(
        f"Train: {len(train_pairs)}"
    )

    print(
        f"Val: {len(val_pairs)}"
    )


# ============================================================
# DATA.YAML
# ============================================================

def write_yaml():

    yaml_path = (
        OUTPUT /
        "data.yaml"
    )

    with open(
        yaml_path,
        "w",
        encoding="utf-8"
    ) as f:

        f.write(
            "path: "
            + str(OUTPUT).replace(
                "\\",
                "/"
            )
            + "\n\n"
        )

        f.write(
            "train: images/train\n"
        )

        f.write(
            "val: images/val\n\n"
        )

        f.write(
            "nc: 14\n"
        )

        f.write(
            "names:\n"
        )

        for i, name in enumerate(
            CLASS_NAMES
        ):

            f.write(
                f"  {i}: {name}\n"
            )

    print(
        f"\ndata.yaml created:"
        f"\n{yaml_path}"
    )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    random.seed(42)

    print("\n")
    print("=" * 70)
    print(
        "FINAL 14-CLASS DATASET"
    )
    print("=" * 70)

    process_dhakaai()

    process_voc(
        "indian",
        INDIAN_MAPPING
    )

    process_voc(
        "auto",
        AUTO_MAPPING
    )

    process_voc(
        "small",
        SMALL_MAPPING
    )

    process_voc(
        "construction",
        CONSTRUCTION_MAPPING
    )

    process_ambulance()

    write_yaml()

    print("\n")
    print("=" * 70)
    print(
        "FINAL CLASS DISTRIBUTION"
    )
    print("=" * 70)

    print(
        f"{'ID':<5}"
        f"{'CLASS':<25}"
        f"{'OBJECTS':>10}"
        f"{'IMAGES':>10}"
    )

    print("-" * 60)

    for i, name in enumerate(
        CLASS_NAMES
    ):

        print(
            f"{i:<5}"
            f"{name:<25}"
            f"{final_object_counts[i]:>10}"
            f"{final_image_counts[i]:>10}"
        )

    print("\nDataset creation complete.")

    print(
        f"Location: {OUTPUT}"
    )