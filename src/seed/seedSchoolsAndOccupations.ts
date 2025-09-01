// src/seed/seedSchoolsAndOccupations.ts
import { AppDataSource } from '../data-source';
import { School } from '../entity/School';
import { Occupation } from '../entity/Occupation';

export async function seedSchoolsAndOccupations() {
    try {
        await AppDataSource.initialize();
        console.log('Data Source initialized...');

        const schoolRepository = AppDataSource.getRepository(School);
        const occupationRepository = AppDataSource.getRepository(Occupation);


        // 2. Kreiraj škole
        const schools = await schoolRepository.save([
            { name: 'Средња техничка школа' },
            { name: 'Средња школа ДОСИТЕЈ' },
            { name: 'Средња медицинска школа' },
            { name: 'Београдска уметничка школа за дизајн и нове медије' },
            { name: 'Висока школа академских студија ДОСИТЕЈ' },
            { name: 'Висока бродарска школа' }
        ]);
        console.log('Kreirane škole:', schools.length);

        // 3. Pronađi škole po imenu za kasnije korišćenje
        const tehnickaSkola = schools.find(s => s.name === 'Средња техничка школа')!;
        const dositejSkola = schools.find(s => s.name === 'Средња школа ДОСИТЕЈ')!;
        const medicinskaSkola = schools.find(s => s.name === 'Средња медицинска школа')!;
        const umetnickaSkola = schools.find(s => s.name === 'Београдска уметничка школа за дизајн и нове медије')!;
        const visokaDositej = schools.find(s => s.name === 'Висока школа академских студија ДОСИТЕЈ')!;
        const visokaBrodarska = schools.find(s => s.name === 'Висока бродарска школа')!;

        // 4. Kreiraj zanimanja za svaku školu
        const occupationsData = [
            // Средња техничка школа
            { name: 'Администратор рачунарских мрежа', school: tehnickaSkola },
            { name: 'Архитектонски тахничар', school: tehnickaSkola },
            { name: 'Аутомеханичар', school: tehnickaSkola },
            { name: 'Аутомеханичар специјалиста', school: tehnickaSkola },
            { name: 'Возач моторних возила', school: tehnickaSkola },
            { name: 'Возач моторних возила специјалиста', school: tehnickaSkola },
            { name: 'Гимназија за ученике са посебним способностима за рачунарство и информатику', school: tehnickaSkola },
            { name: 'Грађевински техничар за нискоградњу', school: tehnickaSkola },
            { name: 'Декоратер зидних површина-молер', school: tehnickaSkola },
            { name: 'Електротехничар информационих технологија', school: tehnickaSkola },
            { name: 'Електротехничар рачунара', school: tehnickaSkola },
            { name: 'Електротехничар рачунара специјалиста', school: tehnickaSkola },
            { name: 'Зидар фасадер', school: tehnickaSkola },
            { name: 'Инструктор вожње специјалиста', school: tehnickaSkola },
            { name: 'Керамичар-терацер-пећар', school: tehnickaSkola },
            { name: 'Конобар', school: tehnickaSkola },
            { name: 'Кувар', school: tehnickaSkola },
            { name: 'Кулинарски техничар', school: tehnickaSkola },
            { name: 'Мајстор за грађевинску механизацију', school: tehnickaSkola },
            { name: 'Мајстор за кућне водоводне и канализационе инсталације', school: tehnickaSkola },

            // Средња школа ДОСИТЕЈ
            { name: 'Бродомашински техничар', school: dositejSkola },
            { name: 'Економија', school: dositejSkola },
            { name: 'Економски техничар', school: dositejSkola },
            { name: 'Електроенергетичар мрежа и постројења специјалиста', school: dositejSkola },
            { name: 'Електромонтер мреже и постројења', school: dositejSkola },
            { name: 'Електротехничар енергетике', school: dositejSkola },
            { name: 'Гимназија друштвено-језичког смера', school: dositejSkola },
            { name: 'Машинбравар', school: dositejSkola },
            { name: 'Машински техничар', school: dositejSkola },
            { name: 'Механичар алатних машина специјалиста', school: dositejSkola },
            { name: 'Механичар термоенергетских постројења', school: dositejSkola },
            { name: 'Механичар термоенергетских постројења специјалиста', school: dositejSkola },
            { name: 'Наутички техничар', school: dositejSkola },
            { name: 'Оптометриста специјалиста', school: dositejSkola },
            { name: 'Општа гимназија', school: dositejSkola },
            { name: 'Пословни секретар', school: dositejSkola },
            { name: 'Прани техничар', school: dositejSkola },

            // Средња медицинска школа
            { name: 'Здравствени неговатељ', school: medicinskaSkola },
            { name: 'Зубни техничар', school: medicinskaSkola },
            { name: 'Козметички техничар', school: medicinskaSkola },
            { name: 'Лабораторијски техничар', school: medicinskaSkola },
            { name: 'Масер', school: medicinskaSkola },
            { name: 'Медицинска сестра васпитач', school: medicinskaSkola },
            { name: 'Медицинска сестра техничар', school: medicinskaSkola },
            { name: 'Медицинска сестра техничар за рад у општој медицини', school: medicinskaSkola },
            { name: 'Медицински техничар за рад у радиологији', school: medicinskaSkola },
            { name: 'Педијатријска сестра', school: medicinskaSkola },

            // Београдска уметничка школа за дизајн и нове медије
            { name: 'Ликовни техничар', school: umetnickaSkola },

            // Висока школа академских студија ДОСИТЕЈ
            { name: 'Економија високообразовање', school: visokaDositej },
            { name: 'Информатика високообразовање', school: visokaDositej },
            { name: 'Мастер академске студије Економија', school: visokaDositej },
            { name: 'Мастер академске студије Информатика', school: visokaDositej },

            // Висока бродарска школа
            { name: 'Бродомашинство', school: visokaBrodarska },
            { name: 'Лучки менаџмент', school: visokaBrodarska },
            { name: 'Наутика', school: visokaBrodarska }
        ];

        // 5. Sačuvaj sva zanimanja
        const occupations = occupationsData.map(data => {
            const occupation = new Occupation();
            occupation.name = data.name;
            occupation.school = data.school;
            return occupation;
        });

        const savedOccupations = await occupationRepository.save(occupations);
        console.log('Kreirana zanimanja:', savedOccupations.length);

        console.log('✅ Seed uspešno završen!');

    } catch (error) {
        console.error('❌ Greška pri seed-u:', error);
    } finally {
        await AppDataSource.destroy();
        console.log('Data Source destroyed...');
    }
}

// Pokreni seed ako se skripta pokreće direktno
if (require.main === module) {
    seedSchoolsAndOccupations();
}