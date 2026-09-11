import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)

def principled(name, color, metal=0, rough=.2, transmission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['IOR'].default_value=1.46
    bs.inputs['Transmission Weight'].default_value=transmission
    bs.inputs['Coat Weight'].default_value=.38
    bs.inputs['Coat Roughness'].default_value=.13
    return m

root=bpy.data.objects.new('Flower_Root',None); bpy.context.collection.objects.link(root)
root['description']='AURELIA V3 / ten smoked glass petals / five outer spread controls'
root['morph_convention']='Spread_Out: 0=normal flower, 1=spread. Bloom_Closed: 0=normal flower, 1=folded. Do not combine both at full strength.'
mat=principled('Petal | smoked indigo glass',(.09,.14,.3),.23,.145,.82)
bs=mat.node_tree.nodes.get('Principled BSDF')
col=mat.node_tree.nodes.new('ShaderNodeVertexColor'); col.layer_name='PetalTint'
mat.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color'])

NU,NV=64,32
petals=[]
palettes=[((.018,.025,.065),(.14,.22,.43)),((.02,.035,.075),(.18,.28,.40)),((.022,.025,.065),(.14,.19,.38)),((.015,.025,.07),(.085,.16,.46)),((.02,.03,.06),(.19,.25,.34))]

def point(u,v,side,idx,closed=False):
    length=[3.15,3.28,3.10,3.23,3.18][idx]
    envelope=sin(pi*u)**.72
    width=(1.10+.055*sin(idx*2))*envelope*(.80+.25*u)
    y=width*v + .46*sin(pi*u)*u
    x=length*u + .10*v*v*sin(pi*u)
    z=.12 + .72*u*u + .44*envelope*v*v + .26*u**9
    z+=.38*sin(pi*u)*v
    z+=.025*math.exp(-v*v*45)*sin(pi*u)
    z+=.002*sin(36*v+u*10)*sin(pi*u)*(1-v*v)
    thick=.045+.12*envelope*(1-.50*abs(v))
    if closed:
        x=.86*sin(pi*u*.98)+.035*u
        y*=.66
        z=.12+length*.94*u+.20*envelope*v*v
        # Thickness follows the outward-facing bud shell.
        return (x-side*thick*.5,y,z)
    return (x,y,z+side*thick*.5)

for idx in range(5):
    verts=[]; closed=[]; uvparams=[]; faces=[]
    for side in [1,-1]:
        for i in range(NU+1):
            # A very narrow end ring avoids coincident tip vertices.
            u=.001+.998*i/NU
            for j in range(NV+1):
                v=-1+2*j/NV
                verts.append(point(u,v,side,idx))
                closed.append(point(u,v,side,idx,True))
                uvparams.append((u,v))
    stride=NV+1; layer=(NU+1)*stride
    for k in range(2):
        for i in range(NU):
            for j in range(NV):
                a=k*layer+i*stride+j
                f=(a,a+stride,a+stride+1,a+1)
                faces.append(f if k==0 else tuple(reversed(f)))
    boundary=list(range(stride)) + [i*stride+NV for i in range(1,NU+1)] + [NU*stride+j for j in range(NV-1,-1,-1)] + [i*stride for i in range(NU-1,0,-1)]
    for a,b in zip(boundary,boundary[1:]+boundary[:1]): faces.append((b,a,a+layer,b+layer))
    mesh=bpy.data.meshes.new(f'Petal_{idx+1:02d}_Topology'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(f'Petal_{idx+1:02d}',mesh); bpy.context.collection.objects.link(obj)
    theta=2*pi*idx/5+.22
    obj.location=(.19*cos(theta),.19*sin(theta),0)
    obj.rotation_euler[2]=theta; obj.parent=root
    obj['petal_index']=idx+1
    obj['animation']='Bloom_Closed morph: 0=open; 1=closed. Local +X points from base to tip; local Y is hinge axis.'
    obj.data.materials.append(mat)
    for poly in mesh.polygons: poly.use_smooth=True
    colors=mesh.color_attributes.new(name='PetalTint',type='FLOAT_COLOR',domain='POINT')
    ca,cb=palettes[idx]
    for n,(u,v) in enumerate(uvparams):
        t=min(1,u*.85+abs(v)*.18)
        rgb=[ca[c]*(1-t)+cb[c]*t for c in range(3)]
        edge=(abs(v)**8)*.055
        colors.data[n].color=(*(r*(1-edge)+.94*edge for r in rgb),1)
    basis=obj.shape_key_add(name='Basis')
    key=obj.shape_key_add(name='Bloom_Closed')
    for n,p in enumerate(closed): key.data[n].co=p
    petals.append(obj)

# A low, continuous dark aperture replaces the ornamental pearl assembly.
coremat=principled('Center | graphite glass',(.016,.022,.038),.36,.25,.20)
bpy.ops.mesh.primitive_torus_add(major_radius=.28,minor_radius=.095,major_segments=64,minor_segments=16,location=(0,0,.20))
center=bpy.context.object;center.name='Flower_Center';center.parent=root
center.scale.z=.64
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
center.data.materials.append(coremat)
for p in center.data.polygons:p.use_smooth=True
bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')

# Preserve a fuller normal flower pose, with an independent outward spread.
for o in petals:
    basis=o.data.shape_keys.key_blocks['Basis']
    closed=o.data.shape_keys.key_blocks['Bloom_Closed']
    original=[p.co.copy() for p in basis.data]
    spread=o.shape_key_add(name='Spread_Out')
    for n,p in enumerate(original):
        basis.data[n].co=p.lerp(closed.data[n].co,.24)
        spread.data[n].co=(p.x*1.10,p.y,p.z*.86)
    o['role']='outer animated petal'
    o['animation']='Spread_Out 0=normal flower, 1=spread outward. Bloom_Closed 1=folded. Set the other morph to zero.'

# Five smaller, offset inner petals keep the center full during the outer sequence.
inner=[]
for i,outer in enumerate(petals):
    o=outer.copy();o.data=outer.data.copy();bpy.context.collection.objects.link(o)
    o.name=f'Inner_Petal_{i+1:02d}';o.data.name=f'Inner_Petal_{i+1:02d}_Topology'
    o.shape_key_remove(o.data.shape_keys.key_blocks['Spread_Out'])
    o.rotation_euler.z+=pi/5
    o.scale=(.60,.63,.70)
    theta=o.rotation_euler.z
    o.location=(.12*cos(theta),.12*sin(theta),.28)
    o['role']='inner petal following matching outer petal'
    o['animation']='Bloom_Closed: 0=open, 1=folded. Opens after the matching outer petal starts.'
    inner.append(o)

# Start fully folded. Five outer petals unfold consecutively; each inner petal follows its outer partner.
for i in range(5):
    for o,delay in [(petals[i],0),(inner[i],8)]:
        o.data.shape_keys.animation_data_clear()
        for k in o.data.shape_keys.key_blocks:k.value=0
        key=o.data.shape_keys.key_blocks['Bloom_Closed']
        start=10+i*28+delay
        end=10+i*28+24
        for frame,val in [(1,1),(start,1),(end,0),(150,0)]:
            key.value=val;key.keyframe_insert('value',frame=frame)
        o.data.shape_keys.animation_data.action.name=f'Unfold_{o.name}'
scene=bpy.context.scene
scene.frame_start=1;scene.frame_end=150;scene.render.fps=30;scene.frame_set(1)

# Export only the asset, without the photography setup.
bpy.ops.object.select_all(action='DESELECT')
for o in [root,center]+petals+inner:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'aurelia_flower.glb'),export_format='GLB',use_selection=True,export_animations=True,export_morph=True,export_extras=True,export_yup=True)
scene.frame_set(1)

studio=bpy.data.collections.new('STUDIO | render only');scene.collection.children.link(studio)
def tostudio(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    studio.objects.link(o)
floor=principled('Backdrop | charcoal',(.018,.022,.03),0,.7)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.30));ground=bpy.context.object;ground.name='Studio_Backdrop';ground.data.materials.append(floor);tostudio(ground)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,power,color,size,shape='DISK',size_y=None):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape=shape;data.size=size
    if size_y is not None:data.size_y=size_y
    o=bpy.data.objects.new(name,data);studio.objects.link(o);o.location=loc;aim(o,(0,0,.2))
area('Key | softbox',(1,-3,7),1100,(.92,.96,1),4)
area('Rim | ice',(-4,1,4),1450,(.66,.79,1),3)
area('Ribbon | white',(3,4,5),1600,(1,1,1),4,'RECTANGLE',.65)
area('Front | reflection strip',(1,-5,2.5),450,(.77,.87,1),3,'RECTANGLE',.5)
world=bpy.data.worlds.new('Studio ambience');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.3,.35,.45,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3;scene.world=world
bpy.ops.object.camera_add(location=(5,-8,11.8));camera=bpy.context.object;camera.name='Camera_Hero';aim(camera,(0,0,.25));camera.data.type='ORTHO';camera.data.ortho_scale=8.5;scene.camera=camera;tostudio(camera)
scene.render.engine='CYCLES';scene.cycles.samples=36;scene.cycles.use_denoising=True
scene.cycles.max_bounces=10;scene.cycles.transmission_bounces=7
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
scene.render.filepath=os.path.join(OUT,'aurelia_hero.png')
# Make the actual flower the initial selection and keep the viewport uncluttered.
bpy.ops.object.select_all(action='DESELECT')
for o in petals:o.select_set(True)
bpy.context.view_layer.objects.active=petals[0]
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=10
            a.spaces.active.region_3d.view_location=Vector((0,0,.4))
            a.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            a.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'aurelia_flower.blend'))
stats={'outer_petals':[o.name for o in petals],'inner_petals':[o.name for o in inner],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in petals+inner+[center]),'morphs':{'Spread_Out':'0=normal, 1=spread','Bloom_Closed':'0=normal, 1=folded'},'blender_version':bpy.app.version_string}
with open(os.path.join(OUT,'asset_info.json'),'w') as f:json.dump(stats,f,indent=2)
scene.frame_set(150)
bpy.ops.render.render(write_still=True)
print('NORMAL_RENDER_COMPLETE',flush=True)
scene.frame_set(150)
for o in petals:o.data.shape_keys.key_blocks['Spread_Out'].value=1
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.cycles.samples=28
scene.render.filepath=os.path.join(OUT,'aurelia_spread.png')
bpy.ops.render.render(write_still=True)
scene.frame_set(1)
for o in petals+inner:
    o.data.shape_keys.animation_data_clear()
    o.data.shape_keys.key_blocks['Bloom_Closed'].value=1
    if 'Spread_Out' in o.data.shape_keys.key_blocks:o.data.shape_keys.key_blocks['Spread_Out'].value=0
camera.location=(6,-9,7);aim(camera,(0,0,1.5));camera.data.ortho_scale=5.6
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.cycles.samples=24
scene.render.filepath=os.path.join(OUT,'aurelia_closed.png')
bpy.ops.render.render(write_still=True)
print('V3_COMPLETE',flush=True)
