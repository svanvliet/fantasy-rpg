import argparse
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args():
    argv = []
    if "--" in __import__("sys").argv:
        argv = __import__("sys").argv[__import__("sys").argv.index("--") + 1 :]

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--preview", required=False)
    parser.add_argument("--target-height", required=False, type=float, default=None)
    return parser.parse_args(argv)


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_corner = Vector(
        (
            min(corner.x for corner in corners),
            min(corner.y for corner in corners),
            min(corner.z for corner in corners),
        )
    )
    max_corner = Vector(
        (
            max(corner.x for corner in corners),
            max(corner.y for corner in corners),
            max(corner.z for corner in corners),
        )
    )
    return min_corner, max_corner


def dimensions_from_bounds(bounds):
    min_corner, max_corner = bounds
    return {
        "x": max_corner.x - min_corner.x,
        "y": max_corner.y - min_corner.y,
        "z": max_corner.z - min_corner.z,
    }


def look_at(camera, target):
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.film_transparent = True
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.image_settings.file_format = "PNG"


def import_model(input_path):
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("No mesh objects were imported from the GLB.")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]

    if len(mesh_objects) > 1:
        bpy.ops.object.join()

    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def align_to_ground(obj):
    bpy.context.view_layer.update()
    min_corner, max_corner = world_bounds(obj)
    center_x = (min_corner.x + max_corner.x) / 2
    center_y = (min_corner.y + max_corner.y) / 2

    obj.location.x -= center_x
    obj.location.y -= center_y
    obj.location.z -= min_corner.z
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)


def scale_to_target_height(obj, target_height):
    if not target_height:
        return
    bpy.context.view_layer.update()
    min_corner, max_corner = world_bounds(obj)
    current_height = max_corner.z - min_corner.z
    if current_height <= 0:
        return
    scale_factor = target_height / current_height
    obj.scale *= scale_factor
    bpy.context.view_layer.update()
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def setup_preview(scene, obj, preview_path):
    if not preview_path:
        return

    scene.render.engine = "BLENDER_EEVEE"

    world = bpy.data.worlds.new("CleanupWorld")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.96, 0.96, 0.96, 1.0)
    background.inputs[1].default_value = 0.8
    scene.world = world

    bpy.ops.object.light_add(type="AREA", location=(1.8, -1.8, 2.2))
    key_light = bpy.context.object
    key_light.data.energy = 2200
    key_light.data.shape = "RECTANGLE"
    key_light.data.size = 1.4
    key_light.data.size_y = 1.4

    bpy.ops.object.light_add(type="AREA", location=(-1.6, 1.5, 1.6))
    fill_light = bpy.context.object
    fill_light.data.energy = 1100
    fill_light.data.shape = "RECTANGLE"
    fill_light.data.size = 1.8
    fill_light.data.size_y = 1.8

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera

    min_corner, max_corner = world_bounds(obj)
    dimensions = dimensions_from_bounds((min_corner, max_corner))
    radius = max(dimensions["x"], dimensions["y"], dimensions["z"], 0.1)
    camera.location = Vector((radius * 2.4, -radius * 2.1, radius * 1.7))
    look_at(camera, Vector((0.0, 0.0, dimensions["z"] * 0.5)))

    scene.render.filepath = str(preview_path)
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    preview_path = Path(args.preview).resolve() if args.preview else None

    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    if preview_path:
        preview_path.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    obj = import_model(input_path)
    initial_bounds = world_bounds(obj)
    initial_dimensions = dimensions_from_bounds(initial_bounds)

    align_to_ground(obj)
    scale_to_target_height(obj, args.target_height)
    final_bounds = world_bounds(obj)
    final_dimensions = dimensions_from_bounds(final_bounds)

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
    )

    setup_preview(bpy.context.scene, obj, preview_path)

    materials = sorted(
        {slot.material.name for slot in obj.material_slots if slot.material is not None}
    )
    report = {
        "input": str(input_path),
        "output": str(output_path),
        "preview": str(preview_path) if preview_path else None,
        "targetHeight": args.target_height,
        "initialDimensions": initial_dimensions,
        "finalDimensions": final_dimensions,
        "materialCount": len(materials),
        "materials": materials,
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
