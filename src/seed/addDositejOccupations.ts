// Dodaje nova zanimanja Srednjoj školi ДОСИТЕЈ (bezbedno za višestruko pokretanje —
// preskače zanimanja koja već postoje).
// Pokretanje: npm run seed:dositej
import { AppDataSource } from '../data-source';
import { School } from '../entity/School';
import { Occupation } from '../entity/Occupation';

const NOVA_ZANIMANJA = [
    'Техничар оптике',
    'Правно-пословни техничар',
];

export async function addDositejOccupations() {
    try {
        await AppDataSource.initialize();
        console.log('Data Source initialized...');

        const schoolRepository = AppDataSource.getRepository(School);
        const occupationRepository = AppDataSource.getRepository(Occupation);

        const dositejSkola = await schoolRepository.findOne({
            where: { name: 'Средња школа ДОСИТЕЈ' },
            relations: ['occupations'],
        });

        if (!dositejSkola) {
            console.error('❌ Škola "Средња школа ДОСИТЕЈ" nije pronađena u bazi!');
            return;
        }

        console.log(`Škola pronađena (id=${dositejSkola.id}), trenutno zanimanja: ${dositejSkola.occupations.length}`);

        for (const naziv of NOVA_ZANIMANJA) {
            const postoji = dositejSkola.occupations.some(
                (occ) => occ.name.trim().toLowerCase() === naziv.trim().toLowerCase()
            );

            if (postoji) {
                console.log(`⏭️  Preskačem, već postoji: ${naziv}`);
                continue;
            }

            const occupation = new Occupation();
            occupation.name = naziv;
            occupation.school = dositejSkola;
            await occupationRepository.save(occupation);
            console.log(`✅ Dodato: ${naziv}`);
        }

        console.log('✅ Gotovo!');
    } catch (error) {
        console.error('❌ Greška:', error);
    } finally {
        await AppDataSource.destroy();
        console.log('Data Source destroyed...');
    }
}

if (require.main === module) {
    addDositejOccupations();
}
