# PC Components Data Sources

## Primary Data Sources

### 1. TechPowerUp GPU Database
**Best for:** Graphics cards  
**Format:** Scrapable HTML or downloadable CSV  
**URL:** https://www.techpowerup.com/gpu-specs/  
**Coverage:** ~5000+ GPUs with detailed specs  
**Data Quality:** Excellent  
**Update Frequency:** Regular

**Fields Available:**
- GPU name, manufacturer, chip
- Release date, price
- Memory size, type, bus width
- Core clock, boost clock, shader count
- TDP, power connectors
- PCIe version, length
- Outputs (HDMI, DP, etc.)

**How to Use:**
```bash
# Download GPU database (manual)
curl https://www.techpowerup.com/gpu-specs/ > gpu-database.html

# Or use their CSV export if available
# Parse with cheerio/jsdom
```

### 2. CPU-World / CPU-Upgrade
**Best for:** CPUs  
**URL:** http://www.cpu-world.com/  
**Coverage:** ~10,000+ CPUs  
**Format:** HTML tables (scrapable)

**Alternative:** PassMark CPU Database  
**URL:** https://www.cpubenchmark.net/cpu_list.php  
**Format:** CSV export available  
**Coverage:** ~4000+ current CPUs

### 3. Community Curated Datasets

**GitHub: pc-parts-dataset**
```bash
git clone https://github.com/docmarionum1/pc-part-dataset
# Contains ~50k+ parts from PCPartPicker scrapes
```

**GitHub: hardware-specs**
```bash
git clone https://github.com/awesome-hardware/hardware-specs
# Community-maintained JSON files
```

### 4. Manufacturer Spec Sheets (Manual)
- ASUS, MSI, Gigabyte, ASRock product pages
- Corsair, EVGA, Seasonic PSU specs
- Fractal, NZXT, Lian Li case specs

## Implementation Strategy

### Phase 1: Seed Database (Week 1)
1. Download TechPowerUp GPU database → parse → seed DB  
2. Download PassMark CPU database → parse → seed DB  
3. Manually curate 50-100 popular motherboards  
4. Manually curate 50-100 popular cases  
5. Manually curate 30-50 PSUs  
6. Manually curate 30-50 coolers

### Phase 2: Expand Database (Week 2-3)
1. Add more motherboards from manufacturer sites  
2. Add more cases from popular brands  
3. Add RAM kits from major brands  
4. Add storage from major brands

### Phase 3: Pricing Integration (Week 4)
1. Integrate Amazon Product Advertising API (requires approval)  
2. Or: Manual price updates every 2 weeks  
3. Or: Community price submission system

### Phase 4: Community Contributions (Ongoing)
1. Add "Submit Component" form  
2. Admin approval system  
3. User-contributed pricing updates

