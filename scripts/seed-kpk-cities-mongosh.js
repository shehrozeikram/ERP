const DB_NAME = 'sgc_erp';
db = db.getSiblingDB(DB_NAME);

const kpkCities = [
  'Peshawar',
  'Charsadda',
  'Nowshera',
  'Khyber',
  'Mohmand',
  'Abbottabad',
  'Haripur',
  'Mansehra',
  'Battagram',
  'Torghar',
  'Upper Kohistan',
  'Lower Kohistan',
  'Kolai Palas',
  'Swat',
  'Upper Dir',
  'Lower Dir',
  'Chitral Upper',
  'Chitral Lower',
  'Malakand',
  'Buner',
  'Shangla',
  'Bajaur',
  'Mardan',
  'Swabi',
  'Kohat',
  'Karak',
  'Hangu',
  'Kurram',
  'Orakzai',
  'Bannu',
  'Lakki Marwat',
  'North Waziristan',
  'Dera Ismail Khan',
  'Tank',
  'South Waziristan'
];

const country = db.countries.findOne({
  name: { $regex: /pakistan/i },
  isActive: { $ne: false }
});

if (!country) {
  throw new Error('Pakistan country record not found in countries collection');
}

const province = db.provinces.findOne({
  country: country._id,
  name: { $regex: /khyber pakhtunkhwa|kpk|k\.p\.k/i },
  isActive: { $ne: false }
});

if (!province) {
  throw new Error('KPK province record not found in provinces collection');
}

print(`Using country: ${country.name}`);
print(`Using province: ${province.name}`);

const existingCities = db.cities.find({
  province: province._id,
  country: country._id
}).toArray();

const existingNames = new Map(
  existingCities.map((c) => [String(c.name || '').trim().toLowerCase(), c])
);

const usedCodes = new Set(
  db.cities.find({}, { code: 1, _id: 0 }).toArray().map((c) => String(c.code || '').toUpperCase())
);

const now = new Date();
let codeCounter = 1;

function nextCode() {
  while (true) {
    const code = `KPK${String(codeCounter).padStart(3, '0')}`;
    codeCounter += 1;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

let created = 0;
let exists = 0;

for (const cityName of kpkCities) {
  const key = cityName.trim().toLowerCase();
  const present = existingNames.get(key);
  if (present) {
    exists += 1;
    if (present.isActive === false) {
      db.cities.updateOne(
        { _id: present._id },
        { $set: { isActive: true, updatedAt: now } }
      );
      print(`REACTIVATED ${cityName}`);
    } else {
      print(`EXISTS      ${cityName}`);
    }
    continue;
  }

  const doc = {
    name: cityName,
    code: nextCode(),
    province: province._id,
    country: country._id,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };

  db.cities.insertOne(doc);
  created += 1;
  print(`CREATED     ${cityName} (${doc.code})`);
}

const totalInProvince = db.cities.countDocuments({
  province: province._id,
  country: country._id,
  isActive: { $ne: false }
});

print('\nSummary:');
print(`Created: ${created}`);
print(`Already existed: ${exists}`);
print(`Active cities now in ${province.name}: ${totalInProvince}`);
