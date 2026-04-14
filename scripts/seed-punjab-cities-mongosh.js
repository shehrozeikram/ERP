const DB_NAME = 'sgc_erp';
db = db.getSiblingDB(DB_NAME);

const punjabCities = [
  'Lahore',
  'Kasur',
  'Sheikhupura',
  'Nankana Sahib',
  'Pattoki',
  'Chunian',
  'Muridke',
  'Sharaqpur',
  'Rawalpindi',
  'Gujar Khan',
  'Taxila',
  'Murree',
  'Chakwal',
  'Talagang',
  'Jhelum',
  'Dina',
  'Sohawa',
  'Attock',
  'Fateh Jang',
  'Pindi Gheb',
  'Faisalabad',
  'Jaranwala',
  'Samundri',
  'Chiniot',
  'Jhang',
  'Shorkot',
  'Toba Tek Singh',
  'Gojra',
  'Kamalia',
  'Multan',
  'Shujaabad',
  'Jalalpur Pirwala',
  'Khanewal',
  'Kabirwala',
  'Mian Channu',
  'Lodhran',
  'Dunyapur',
  'Vehari',
  'Burewala',
  'Mailsi',
  'Gujranwala',
  'Kamoke',
  'Wazirabad',
  'Sialkot',
  'Daska',
  'Sambrial',
  'Pasrur',
  'Narowal',
  'Shakargarh',
  'Gujrat',
  'Kharian',
  'Lalamusa',
  'Mandi Bahauddin',
  'Phalia',
  'Malakwal',
  'Hafizabad',
  'Pindi Bhattian',
  'Bahawalpur',
  'Ahmedpur East',
  'Hasilpur',
  'Bahawalnagar',
  'Chishtian',
  'Fort Abbas',
  'Rahim Yar Khan',
  'Sadiqabad',
  'Khanpur',
  'Sargodha',
  'Bhalwal',
  'Shahpur',
  'Bhakkar',
  'Darya Khan',
  'Khushab',
  'Jauharabad',
  'Mianwali',
  'Isa Khel',
  'Sahiwal',
  'Chichawatni',
  'Okara',
  'Depalpur',
  'Renala Khurd',
  'Pakpattan',
  'Arifwala',
  'D.G. Khan',
  'Taunsa',
  'Kot Addu',
  'Layyah',
  'Muzaffargarh',
  'Alipur',
  'Rajanpur',
  'Jampur',
  'Mithankot'
];

const country = db.countries.findOne({
  name: { $regex: /pakistan/i },
  isActive: { $ne: false }
});
if (!country) throw new Error('Pakistan country record not found');

const province = db.provinces.findOne({
  country: country._id,
  name: { $regex: /^punjab$/i },
  isActive: { $ne: false }
});
if (!province) throw new Error('Punjab province record not found');

print(`Using country: ${country.name}`);
print(`Using province: ${province.name}`);

const existingCities = db.cities.find({ province: province._id, country: country._id }).toArray();
const existingNames = new Map(existingCities.map((c) => [String(c.name || '').trim().toLowerCase(), c]));
const usedCodes = new Set(
  db.cities.find({}, { code: 1, _id: 0 }).toArray().map((c) => String(c.code || '').toUpperCase())
);

const now = new Date();
let codeCounter = 1;
function nextCode() {
  while (true) {
    const code = `PNJ${String(codeCounter).padStart(3, '0')}`;
    codeCounter += 1;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

let created = 0;
let exists = 0;

for (const cityName of punjabCities) {
  const key = cityName.trim().toLowerCase();
  const present = existingNames.get(key);
  if (present) {
    exists += 1;
    if (present.isActive === false) {
      db.cities.updateOne({ _id: present._id }, { $set: { isActive: true, updatedAt: now } });
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
