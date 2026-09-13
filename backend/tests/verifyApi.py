import urllib.request
import urllib.parse
import json

base = 'http://localhost:3001/api'

# 1. Health
with urllib.request.urlopen(f'{base}/health') as r:
    health = json.loads(r.read().decode())
    print('Health Check:')
    print('  Status:', health.get('status'))
    print('  Service:', health.get('service'))
    print('  Spatial Constraint:', health.get('spatialConstraint'))
    print('  Total POIs:', health.get('totalPois'))

# 2. Categories
with urllib.request.urlopen(f'{base}/categories') as r:
    cats = json.loads(r.read().decode())
    print('\nCategories:')
    for c in cats.get('data', []):
        print(f"  {c['category']}: {c['count']} POIs - {c['description']}")

# 3. Proximity queries (500m, 1000m, 3000m)
print('\nProximity Radius Filtering (Center: Plaza de la Virgen Blanca [-2.6716, 42.8467]):')
for rad in [500, 1000, 3000]:
    url = f'{base}/pois?lat=42.8467&lon=-2.6716&radius={rad}'
    with urllib.request.urlopen(url) as r:
        res = json.loads(r.read().decode())
        pois = res.get('data', [])
        print(f"  Radius {rad}m -> {len(pois)} POIs found.")
        if pois:
            print(f"    Nearest: {pois[0]['name']} ({pois[0]['distance_meters']}m)")
            print(f"    Farthest: {pois[-1]['name']} ({pois[-1]['distance_meters']}m)")

# 4. Category queries
print('\nCategory Filter Queries:')
for cat in ['Patrimonio', 'Naturaleza', 'Cultura', 'Gastronomía']:
    url = f"{base}/pois?category={urllib.parse.quote(cat)}"
    with urllib.request.urlopen(url) as r:
        res = json.loads(r.read().decode())
        pois = res.get('data', [])
        print(f"  {cat}: {len(pois)} POIs returned. Sample: {pois[0]['name']} ({pois[0]['subcategory']})")
