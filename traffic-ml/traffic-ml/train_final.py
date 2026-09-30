from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model.train(
    data="FINAL_TRAFFIC_DATASET/data.yaml",

    imgsz=640,
    epochs=40,
    batch=4,
    device=0,

    workers=0,

    patience=10,

    project="runs/final_traffic",
    name="yolov8n_final_14class",

    pretrained=True,
    cache=False,

    seed=42,
    val=True,
    plots=True,
)