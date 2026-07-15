// Srpska transliteracija latinica <-> ćirilica (koristi se za pretragu)

const digraphsLatCyr: [string, string][] = [
    ['dž', 'џ'], ['Dž', 'Џ'], ['DŽ', 'Џ'],
    ['lj', 'љ'], ['Lj', 'Љ'], ['LJ', 'Љ'],
    ['nj', 'њ'], ['Nj', 'Њ'], ['NJ', 'Њ'],
];

const singleLatCyr: Record<string, string> = {
    a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', đ: 'ђ', e: 'е', ž: 'ж', z: 'з', i: 'и',
    j: 'ј', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т',
    ć: 'ћ', u: 'у', f: 'ф', h: 'х', c: 'ц', č: 'ч', š: 'ш',
    A: 'А', B: 'Б', V: 'В', G: 'Г', D: 'Д', Đ: 'Ђ', E: 'Е', Ž: 'Ж', Z: 'З', I: 'И',
    J: 'Ј', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', R: 'Р', S: 'С', T: 'Т',
    Ć: 'Ћ', U: 'У', F: 'Ф', H: 'Х', C: 'Ц', Č: 'Ч', Š: 'Ш',
};

export function latinToCyrillic(text: string): string {
    let result = '';
    let i = 0;
    while (i < text.length) {
        const two = text.substring(i, i + 2);
        const digraph = digraphsLatCyr.find(([lat]) => lat === two);
        if (digraph) {
            result += digraph[1];
            i += 2;
            continue;
        }
        const ch = text[i];
        result += singleLatCyr[ch] ?? ch;
        i++;
    }
    return result;
}

const cyrLat: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i',
    ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I',
    Ј: 'J', К: 'K', Л: 'L', Љ: 'Lj', М: 'M', Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R',
    С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č', Џ: 'Dž', Ш: 'Š',
};

export function cyrillicToLatin(text: string): string {
    return [...text].map((ch) => cyrLat[ch] ?? ch).join('');
}

// Sve varijante pojma za pretragu: original, latinica i ćirilica,
// uključujući i "dj" kao čest način kucanja slova "đ"
export function searchVariants(term: string): string[] {
    const variants = new Set<string>([term]);
    variants.add(cyrillicToLatin(term));
    variants.add(latinToCyrillic(term));

    if (/dj/i.test(term)) {
        const withDj = term.replace(/DJ|Dj/g, 'Đ').replace(/dj/g, 'đ');
        variants.add(withDj);
        variants.add(latinToCyrillic(withDj));
    }

    return [...variants];
}
