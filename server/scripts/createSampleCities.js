const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleCities() {
  try {
    console.log('\n🏙️ Creating Sample Cities...\n');

    // Get existing provinces and countries
    const provinces = await Province.find({ isActive: true }).populate('country');
    if (provinces.length === 0) {
      console.log('❌ No provinces found. Please run createSampleProvinces.js first.');
      return;
    }

    // Clear existing cities
    await City.deleteMany({});
    console.log('🧹 Cleared existing cities');

    const sampleCities = [
      // Pakistan Cities
      {
        name: 'Karachi',
        code: 'KHI',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 14916456,
        timezone: 'UTC+5'
      },
      {
        name: 'Lahore',
        code: 'LHR',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 11126285,
        timezone: 'UTC+5'
      },
      {
        name: 'Faisalabad',
        code: 'FSD',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 3204726,
        timezone: 'UTC+5'
      },
      {
        name: 'Rawalpindi',
        code: 'RWP',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 2098231,
        timezone: 'UTC+5'
      },
      {
        name: 'Islamabad',
        code: 'ISB',
        province: provinces.find(p => p.name === 'Federal Territory')?._id,
        country: provinces.find(p => p.name === 'Federal Territory')?.country._id,
        population: 1014825,
        timezone: 'UTC+5'
      },
      {
        name: 'Peshawar',
        code: 'PES',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 1970042,
        timezone: 'UTC+5'
      },
      {
        name: 'Quetta',
        code: 'QUE',
        province: provinces.find(p => p.name === 'Balochistan')?._id,
        country: provinces.find(p => p.name === 'Balochistan')?.country._id,
        population: 1001205,
        timezone: 'UTC+5'
      },
      {
        name: 'Gujranwala',
        code: 'GUJ',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 2027001,
        timezone: 'UTC+5'
      },
      {
        name: 'Multan',
        code: 'MUL',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 1871843,
        timezone: 'UTC+5'
      },
      {
        name: 'Sialkot',
        code: 'SIA',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 655852,
        timezone: 'UTC+5'
      },
      {
        name: 'Bahawalpur',
        code: 'BAH',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 762111,
        timezone: 'UTC+5'
      },
      {
        name: 'Sargodha',
        code: 'SAR',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 659862,
        timezone: 'UTC+5'
      },
      {
        name: 'Sheikhupura',
        code: 'SHE',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 473129,
        timezone: 'UTC+5'
      },
      {
        name: 'Jhang',
        code: 'JHA',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 414131,
        timezone: 'UTC+5'
      },
      {
        name: 'Dera Ghazi Khan',
        code: 'DGK',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 399064,
        timezone: 'UTC+5'
      },
      {
        name: 'Gujrat',
        code: 'GJT',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 390533,
        timezone: 'UTC+5'
      },
      {
        name: 'Rahim Yar Khan',
        code: 'RYK',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 420419,
        timezone: 'UTC+5'
      },
      {
        name: 'Kasur',
        code: 'KAS',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 358409,
        timezone: 'UTC+5'
      },
      {
        name: 'Okara',
        code: 'OKA',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 357935,
        timezone: 'UTC+5'
      },
      {
        name: 'Sahiwal',
        code: 'SAH',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 389605,
        timezone: 'UTC+5'
      },
      {
        name: 'Wah Cantonment',
        code: 'WAH',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 380103,
        timezone: 'UTC+5'
      },
      {
        name: 'Mianwali',
        code: 'MIA',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 95007,
        timezone: 'UTC+5'
      },
      {
        name: 'Chiniot',
        code: 'CHI',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 278747,
        timezone: 'UTC+5'
      },
      {
        name: 'Kamoke',
        code: 'KAM',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 249767,
        timezone: 'UTC+5'
      },
      {
        name: 'Hafizabad',
        code: 'HAF',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 245784,
        timezone: 'UTC+5'
      },
      {
        name: 'Sadiqabad',
        code: 'SAD',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 238422,
        timezone: 'UTC+5'
      },
      {
        name: 'Burewala',
        code: 'BUR',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 231797,
        timezone: 'UTC+5'
      },
      {
        name: 'Khanewal',
        code: 'KHW',
        province: provinces.find(p => p.name === 'Punjab')?._id,
        country: provinces.find(p => p.name === 'Punjab')?.country._id,
        population: 227059,
        timezone: 'UTC+5'
      },
      {
        name: 'Dera Ismail Khan',
        code: 'DIK',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 217457,
        timezone: 'UTC+5'
      },
      {
        name: 'Mardan',
        code: 'MAR',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 358604,
        timezone: 'UTC+5'
      },
      {
        name: 'Mingora',
        code: 'MIN',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 331091,
        timezone: 'UTC+5'
      },
      {
        name: 'Kohat',
        code: 'KOH',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 228779,
        timezone: 'UTC+5'
      },
      {
        name: 'Abbottabad',
        code: 'ABB',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 148587,
        timezone: 'UTC+5'
      },
      {
        name: 'Mansehra',
        code: 'MNS',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 127623,
        timezone: 'UTC+5'
      },
      {
        name: 'Swabi',
        code: 'SWA',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 123412,
        timezone: 'UTC+5'
      },
      {
        name: 'Nowshera',
        code: 'NOW',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 120131,
        timezone: 'UTC+5'
      },
      {
        name: 'Charsadda',
        code: 'CHA',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 105414,
        timezone: 'UTC+5'
      },
      {
        name: 'Jamrud',
        code: 'JAM',
        province: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?._id,
        country: provinces.find(p => p.name === 'Khyber Pakhtunkhwa')?.country._id,
        population: 101374,
        timezone: 'UTC+5'
      },
      {
        name: 'Hyderabad',
        code: 'HYD',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 1734309,
        timezone: 'UTC+5'
      },
      {
        name: 'Sukkur',
        code: 'SUK',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 499900,
        timezone: 'UTC+5'
      },
      {
        name: 'Larkana',
        code: 'LAR',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 490508,
        timezone: 'UTC+5'
      },
      {
        name: 'Nawabshah',
        code: 'NAW',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 279688,
        timezone: 'UTC+5'
      },
      {
        name: 'Mirpur Khas',
        code: 'MPK',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 233916,
        timezone: 'UTC+5'
      },
      {
        name: 'Jacobabad',
        code: 'JAC',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 200815,
        timezone: 'UTC+5'
      },
      {
        name: 'Shikarpur',
        code: 'SHI',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 177682,
        timezone: 'UTC+5'
      },
      {
        name: 'Tando Adam',
        code: 'TAN',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 152425,
        timezone: 'UTC+5'
      },
      {
        name: 'Khairpur',
        code: 'KHP',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 183181,
        timezone: 'UTC+5'
      },
      {
        name: 'Dadu',
        code: 'DAD',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 146179,
        timezone: 'UTC+5'
      },
      {
        name: 'Tando Allahyar',
        code: 'TAL',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 133487,
        timezone: 'UTC+5'
      },
      {
        name: 'Badin',
        code: 'BAD',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 112420,
        timezone: 'UTC+5'
      },
      {
        name: 'Thatta',
        code: 'THA',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 107215,
        timezone: 'UTC+5'
      },
      {
        name: 'Matiari',
        code: 'MAT',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 105031,
        timezone: 'UTC+5'
      },
      {
        name: 'Tando Muhammad Khan',
        code: 'TMK',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 101863,
        timezone: 'UTC+5'
      },
      {
        name: 'Umerkot',
        code: 'UME',
        province: provinces.find(p => p.name === 'Sindh')?._id,
        country: provinces.find(p => p.name === 'Sindh')?.country._id,
        population: 100000,
        timezone: 'UTC+5'
      },
      {
        name: 'Muzaffarabad',
        code: 'MUZ',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 725000,
        timezone: 'UTC+5'
      },
      {
        name: 'Mirpur',
        code: 'MIR',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 456200,
        timezone: 'UTC+5'
      },
      {
        name: 'Kotli',
        code: 'KOT',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 214362,
        timezone: 'UTC+5'
      },
      {
        name: 'Bhimber',
        code: 'BHI',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 420717,
        timezone: 'UTC+5'
      },
      {
        name: 'Bagh',
        code: 'BAG',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 351000,
        timezone: 'UTC+5'
      },
      {
        name: 'Hattian Bala',
        code: 'HAT',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 230529,
        timezone: 'UTC+5'
      },
      {
        name: 'Neelum',
        code: 'NEE',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 191251,
        timezone: 'UTC+5'
      },
      {
        name: 'Haveli',
        code: 'HAV',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 152124,
        timezone: 'UTC+5'
      },
      {
        name: 'Sudhnoti',
        code: 'SUD',
        province: provinces.find(p => p.name === 'Azad Kashmir')?._id,
        country: provinces.find(p => p.name === 'Azad Kashmir')?.country._id,
        population: 297584,
        timezone: 'UTC+5'
      },
      // US Cities
      {
        name: 'Los Angeles',
        code: 'LA',
        province: provinces.find(p => p.name === 'California')?._id,
        country: provinces.find(p => p.name === 'California')?.country._id,
        population: 3979576,
        timezone: 'UTC-8'
      },
      {
        name: 'San Francisco',
        code: 'SF',
        province: provinces.find(p => p.name === 'California')?._id,
        country: provinces.find(p => p.name === 'California')?.country._id,
        population: 873965,
        timezone: 'UTC-8'
      },
      {
        name: 'Houston',
        code: 'HOU',
        province: provinces.find(p => p.name === 'Texas')?._id,
        country: provinces.find(p => p.name === 'Texas')?.country._id,
        population: 2320268,
        timezone: 'UTC-6'
      },
      {
        name: 'New York City',
        code: 'NYC',
        province: provinces.find(p => p.name === 'New York')?._id,
        country: provinces.find(p => p.name === 'New York')?.country._id,
        population: 8336817,
        timezone: 'UTC-5'
      },
      // UK Cities
      {
        name: 'London',
        code: 'LON',
        province: provinces.find(p => p.name === 'England')?._id,
        country: provinces.find(p => p.name === 'England')?.country._id,
        population: 8982000,
        timezone: 'UTC+0'
      },
      {
        name: 'Manchester',
        code: 'MAN',
        province: provinces.find(p => p.name === 'England')?._id,
        country: provinces.find(p => p.name === 'England')?.country._id,
        population: 547627,
        timezone: 'UTC+0'
      },
      {
        name: 'Edinburgh',
        code: 'EDI',
        province: provinces.find(p => p.name === 'Scotland')?._id,
        country: provinces.find(p => p.name === 'Scotland')?.country._id,
        population: 488050,
        timezone: 'UTC+0'
      },
      // Canadian Cities
      {
        name: 'Toronto',
        code: 'TOR',
        province: provinces.find(p => p.name === 'Ontario')?._id,
        country: provinces.find(p => p.name === 'Ontario')?.country._id,
        population: 2930000,
        timezone: 'UTC-5'
      },
      {
        name: 'Montreal',
        code: 'MTL',
        province: provinces.find(p => p.name === 'Quebec')?._id,
        country: provinces.find(p => p.name === 'Quebec')?.country._id,
        population: 1704694,
        timezone: 'UTC-5'
      },
      {
        name: 'Vancouver',
        code: 'VAN',
        province: provinces.find(p => p.name === 'British Columbia')?._id,
        country: provinces.find(p => p.name === 'British Columbia')?.country._id,
        population: 675218,
        timezone: 'UTC-8'
      }
    ];

    // Create new cities
    const createdCities = await City.insertMany(sampleCities);
    
    console.log(`✅ Created ${createdCities.length} cities:`);
    
    // Populate province and country info for display
    const populatedCities = await City.find({})
      .populate('province', 'name code')
      .populate('country', 'name code')
      .sort({ name: 1 });
    
    populatedCities.forEach(city => {
      console.log(`   📋 ${city.name} (${city.code}) - ${city.province?.name}, ${city.country?.name}`);
    });

    console.log('\n🎉 Sample cities created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample cities:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleCities(); 