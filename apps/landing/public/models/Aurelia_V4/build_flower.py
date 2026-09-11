"""Aurelia V4: sculpted optical petals. Blender 5; no external assets."""
import bpy, math, os, json, struct
from math import sin, cos, pi
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene

def material(name,color,metal,rough,transmission):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    for key,val in {'Base Color':(*color,1),'Metallic':metal,'Roughness':rough,'Transmission Weight':transmission,'IOR':1.48,'Coat Weight':.36,'Coat Roughness':.12}.items():bs.inputs[key].default_value=val
    return m

satin=material('01 | satin optical glass',(.25,.40,.50),.06,.18,.88)
rim=material('02 | polished cobalt glass edge',(.045,.16,.40),.10,.09,.90)
innerface=material('03 | inner smoke blue glass',(.045,.16,.32),.10,.20,.84)
coremat=material('04 | deep blue core',(.025,.065,.15),.12,.19,.70)
# A tiny embedded roughness map preserves one material and one mesh per petal.
# This keeps the named outer meshes directly usable by existing Three.js code.
roughmap=bpy.data.images.new('Optical edge roughness',width=8,height=256)
roughmap.colorspace_settings.name='Non-Color'
pixels=[]
for row in range(256):
    a=abs(sin(2*pi*(row+.5)/256));t=min(1,a/.35);t=t*t*(3-2*t)
    value=.085+.095*t
    for col in range(8):pixels.extend((value,value,value,1))
roughmap.pixels=pixels;roughmap.pack()
for m in [satin,innerface]:
    nodes=m.node_tree.nodes;bs=nodes.get('Principled BSDF')
    vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='OpticalTint';m.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
    tex=nodes.new('ShaderNodeTexImage');tex.image=roughmap;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Roughness'])
root=bpy.data.objects.new('Flower_Root',None);bpy.context.collection.objects.link(root)
root['description']='Aurelia V4 — ten sculpted glass petals. Five primary outer controls.'
root['default_pose']='Fully folded. Bloom_Closed: 1=folded; 0=open.'
root['motion']='No baked animation. Use the named meshes and morph targets in your own Three.js system.'

# Closed quad shells: elliptical cross-sections round continuously around the
# rim instead of ending in a hard, extruded perimeter. Single vertex end poles.
RINGS,SEGS=80,64
def surface(u,t,idx,closed=False,spread=False):
    v=cos(t);side=sin(t)
    length=[3.22,3.30,3.18,3.25,3.21][idx]
    env=max(0,sin(pi*u))
    width=1.24*env**.53*(.62+.47*u)
    sweep=.28*sin(pi*u)*u
    x=length*u-.12*u**7
    y=width*v+sweep
    z=.10+1.05*u*u+.20*u**8+.30*env*v*v+.26*env*v
    thickness=.125*env**.56*(.88+.12*u)
    if closed:
        x=.90*sin(pi*u*.96)+.025*u
        y=(width*v+sweep)*.70
        z=.10+length*.94*u+.12*env*v*v
        return (x-side*thickness,y,z)
    if spread:
        x*=1.12;z=.10+(z-.10)*.64
    return (x,y,z+side*thickness)

def make_petal(idx,inner=False):
    verts=[];closed=[];spread=[];faces=[];slots=[]
    for u in [0]:
        verts.append(surface(u,0,idx));closed.append(surface(u,0,idx,True));spread.append(surface(u,0,idx,False,True))
    for ring in range(1,RINGS):
        u=ring/RINGS
        for j in range(SEGS):
            t=2*pi*j/SEGS
            verts.append(surface(u,t,idx));closed.append(surface(u,t,idx,True));spread.append(surface(u,t,idx,False,True))
    tip=len(verts)
    verts.append(surface(1,0,idx));closed.append(surface(1,0,idx,True));spread.append(surface(1,0,idx,False,True))
    for j in range(SEGS):faces.append((0,1+(j+1)%SEGS,1+j));slots.append(0)
    for ring in range(RINGS-2):
        for j in range(SEGS):
            a=1+ring*SEGS+j;b=1+ring*SEGS+(j+1)%SEGS
            faces.append((a,b,b+SEGS,a+SEGS))
            slots.append(1 if abs(sin(2*pi*(j+.5)/SEGS))<.20 else 0)
    for j in range(SEGS):
        a=1+(RINGS-2)*SEGS+j;b=1+(RINGS-2)*SEGS+(j+1)%SEGS
        faces.append((a,b,tip));slots.append(0)
    # Cross-section first, longitudinal second: outward-facing closed shell.
    name=('Inner_Petal_' if inner else 'Petal_')+f'{idx+1:02d}'
    mesh=bpy.data.meshes.new(name+'_QuadShell');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=root
    angle=idx*2*pi/5+.22+(pi/5 if inner else 0)
    radius=.14 if inner else .19
    o.location=(radius*cos(angle),radius*sin(angle),.24 if inner else 0)
    o.rotation_euler.z=angle
    if inner:o.scale=(.43,.44,1.12)
    mesh.materials.append(innerface if inner else satin)
    uv=mesh.uv_layers.new(name='OpticalUV')
    tint=mesh.color_attributes.new(name='OpticalTint',type='FLOAT_COLOR',domain='POINT')
    facecolor=(.045,.16,.32) if inner else (.25,.40,.50)
    edgecolor=(.045,.16,.40)
    def uv_for(n):
        if n==0:return (0,0)
        if n==tip:return (1,0)
        return (((n-1)//SEGS+1)/RINGS,((n-1)%SEGS)/SEGS)
    for n in range(len(verts)):
        u,t=uv_for(n);a=abs(sin(2*pi*t));w=max(0,1-a/.25);w=w*w*(3-2*w)
        if n in (0,tip):w=0
        tint.data[n].color=(*(facecolor[c]*(1-w)+edgecolor[c]*w for c in range(3)),1)
    for p in mesh.polygons:
        p.use_smooth=True
        coords=[uv_for(n) for n in p.vertices]
        seam=max(t for u,t in coords)-min(t for u,t in coords)>.5
        for loop,(u,t) in zip(p.loop_indices,coords):uv.data[loop].uv=(u,t+1 if seam and t<.5 else t)
    basis=o.shape_key_add(name='Basis',from_mix=False)
    key=o.shape_key_add(name='Bloom_Closed',from_mix=False)
    for n,p in enumerate(closed):
        key.data[n].co=(p[0],p[1],.10+(p[2]-.10)*.62) if inner else p
    key.value=1
    if not inner:
        key=o.shape_key_add(name='Spread_Out',from_mix=False)
        for n,p in enumerate(spread):key.data[n].co=p
        key.value=0
    o['role']='supporting inner petal' if inner else 'primary outer petal'
    o['petal_index']=idx+1
    o['morphs']='Bloom_Closed: 1 folded, 0 open. Spread_Out (outer only): 1 extends the open shape. Do not combine at full strength.'
    o['pivot']='Attachment point. Local +X runs toward tip; local Y is hinge axis.'
    return o

outer=[make_petal(i) for i in range(5)]
inner=[make_petal(i,True) for i in range(5)]
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.21,location=(0,0,.21))
center=bpy.context.object;center.name='Flower_Center';center.scale=(1,1,.60);center.parent=root;center.data.materials.append(coremat)
for p in center.data.polygons:p.use_smooth=True
assets=[root,center]+outer+inner

def pose(closed,spread=0):
    for o in outer+inner:
        o.data.shape_keys.key_blocks['Bloom_Closed'].value=closed
        if 'Spread_Out' in o.data.shape_keys.key_blocks:o.data.shape_keys.key_blocks['Spread_Out'].value=spread

pose(1)
bpy.ops.object.select_all(action='DESELECT')
for o in assets:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'aurelia_flower.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_extras=True,export_yup=True)

studio=bpy.data.collections.new('STUDIO | excluded from GLB');scene.collection.children.link(studio)
def studio_object(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    studio.objects.link(o)
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
def area(name,loc,energy,size,color=(1,1,1),height=None):
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;d.color=color
    d.shape='RECTANGLE' if height else 'DISK'
    if height:d.size_y=height
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=loc;aim(o,(0,0,.6))
floor=material('Studio | neutral graphite',(.048,.055,.066),0,.75,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.42));ground=bpy.context.object;ground.name='Studio_Ground';ground.data.materials.append(floor);studio_object(ground)
area('Key | silk',(0,-4,7),950,5,(.96,.98,1))
area('Edge | long white card',(-4,2,4),1500,4,(.88,.94,1),1.3)
area('Rim | cool card',(4,3,5),1300,3,(.67,.79,1),1.0)
area('Front | narrow card',(2,-5,2),180,3,(1,1,1),.6)
world=bpy.data.worlds.new('Neutral studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.43,.50,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
bpy.ops.object.camera_add(location=(5,-8,8.6));camera=bpy.context.object;camera.name='Camera_Hero';aim(camera,(0,0,.75));camera.data.type='ORTHO';camera.data.ortho_scale=8.2;scene.camera=camera;studio_object(camera)
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=8
scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(OUT,'aurelia_hero.png')
pose(1)
bpy.ops.object.select_all(action='DESELECT')
for o in outer:o.select_set(True)
bpy.context.view_layer.objects.active=outer[0]
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=9
            a.spaces.active.region_3d.view_location=Vector((0,0,1))
            a.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            a.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'aurelia_flower.blend'))

# Validate shells, surface orientation, exported names and initial morph weights.
for o in outer+inner:
    edges={}
    for p in o.data.polygons:
        ids=list(p.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]):
            e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
    assert all(n==2 for n in edges.values()),o.name
    # Signed volume must be positive for an outward-oriented closed shell.
    vol=0
    for p in o.data.polygons:
        ids=list(p.vertices);a=Vector(o.data.vertices[ids[0]].co)
        for j in range(1,len(ids)-1):vol+=a.dot(Vector(o.data.vertices[ids[j]].co).cross(Vector(o.data.vertices[ids[j+1]].co)))/6
    assert vol>0,(o.name,vol)
with open(os.path.join(OUT,'aurelia_flower.glb'),'rb') as f:
    magic,version,size=struct.unpack('<4sII',f.read(12));length,kind=struct.unpack('<II',f.read(8));g=json.loads(f.read(length))
nodes={n.get('name'):n for n in g['nodes']}
for o in outer+inner:
    mesh=g['meshes'][nodes[o.name]['mesh']];index=mesh['extras']['targetNames'].index('Bloom_Closed')
    assert mesh['weights'][index]==1
    assert len(mesh['primitives'])==1,'Named petals must stay single Three.js meshes'
stats={'status':'PASS','petals':10,'outer_names':[o.name for o in outer],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in outer+inner+[center]),'default_pose':'folded','animations':0,'morphs':'Bloom_Closed on all ten; Spread_Out on outer five','glb_bytes':size}
json.dump(stats,open(os.path.join(OUT,'validation.json'),'w'),indent=2)
print('VALIDATED',stats,flush=True)
pose(0);bpy.ops.render.render(write_still=True)
print('HERO_DONE',flush=True)
pose(1);camera.location=(6,-9,7);aim(camera,(0,0,1.5));camera.data.ortho_scale=5.8
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.cycles.samples=32;scene.render.filepath=os.path.join(OUT,'aurelia_closed.png');bpy.ops.render.render(write_still=True)
print('DONE',flush=True)
