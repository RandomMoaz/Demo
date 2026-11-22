// Rashed's replies for small talk, tool cards and action buttons, in the app's six languages.

const en = {
  small: {
    greet: 'Wa alaykum as-salam! Ask me about prayer, wudu, fasting or halal food — or ask for today’s prayer times or the Qibla.',
    thanks: 'Wa iyyak — you’re welcome. Ask me anything else whenever you like.',
    who: 'I’m Rashed, the app’s guide. I give short answers from what scholars teach and link their full words. I can also show your prayer times, find the Qibla, check ingredients and open the map.',
    help: 'You can ask me about prayer, wudu, ghusl, fasting, zakat, Hajj, halal food and more. I can also show today’s prayer times, give the Qibla direction, check an ingredient or E-number, open the map for mosques and halal food, and turn on a prayer alarm.',
    bye: 'Ma’a as-salama — may Allah make things easy for you.',
  },
  english: 'This answer is in English for now.',
  timesH: 'Prayer times today', next: (n, t, x) => `Next: ${n} at ${t} (in ${x})`, sunrise: 'Sunrise',
  qiblaH: 'Qibla from where you are', qibla: (d, dir, km) => `${d}° from north (${dir}) · ${km} km to the Kaaba`, qiblaHint: 'Turn until your phone’s compass shows this direction.',
  dirs: { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' },
  needLoc: { times: 'Share your location and I’ll show the prayer times where you are.', qibla: 'Share your location and I’ll work out the Qibla from where you are.' },
  ingrH: 'What the ingredient checker found', status: { haram: 'Not halal', doubtful: 'Check the source' },
  act: { map: 'Open the map', scanner: 'Scan a product', mushaf: 'Open the Qur’an', alarms: 'Prayer alarms', locate: 'Use my location', alarm: (n) => `Turn on the ${n} alarm` },
  alarmOn: (n, t) => `Done — your ${n} alarm is on and rings at ${t}.`, locFail: 'I couldn’t get your location. You can allow it in the browser settings.',
  also: 'Also related', maybe: 'Did you mean…', read: 'Read aloud', stop: 'Stop reading',
}

const ar = {
  small: {
    greet: 'وعليكم السلام ورحمة الله! اسألني عن الصلاة أو الوضوء أو الصيام أو الطعام الحلال، أو اطلب مواقيت الصلاة اليوم أو اتجاه القبلة.',
    thanks: 'وإيّاك، العفو. اسألني عن أي شيء آخر متى شئت.',
    who: 'أنا راشد، دليل التطبيق. أعطيك جوابًا مختصرًا مما يقرّره أهل العلم وأحيلك إلى كلامهم كاملًا. وأستطيع أيضًا عرض مواقيت صلاتك وتحديد القبلة وفحص المكونات وفتح الخريطة.',
    help: 'اسألني عن الصلاة والوضوء والغسل والصيام والزكاة والحج والطعام الحلال وغيرها. وأستطيع أيضًا عرض مواقيت الصلاة اليوم، وتحديد اتجاه القبلة، وفحص مكوّن أو رمز E، وفتح الخريطة للمساجد والطعام الحلال، وتفعيل منبّه صلاة.',
    bye: 'مع السلامة، يسّر الله أمرك.',
  },
  english: '',
  timesH: 'مواقيت الصلاة اليوم', next: (n, t, x) => `القادمة: ${n} ${t} (بعد ${x})`, sunrise: 'الشروق',
  qiblaH: 'القبلة من موقعك', qibla: (d, dir, km) => `${d}° من الشمال (${dir}) · ${km} كم إلى الكعبة`, qiblaHint: 'استدر حتى تشير بوصلة هاتفك إلى هذا الاتجاه.',
  dirs: { N: 'الشمال', NE: 'الشمال الشرقي', E: 'الشرق', SE: 'الجنوب الشرقي', S: 'الجنوب', SW: 'الجنوب الغربي', W: 'الغرب', NW: 'الشمال الغربي' },
  needLoc: { times: 'شارك موقعك لأعرض لك مواقيت الصلاة حيث أنت.', qibla: 'شارك موقعك لأحدّد لك القبلة من مكانك.' },
  ingrH: 'ما وجده فاحص المكونات', status: { haram: 'غير حلال', doubtful: 'تحقّق من المصدر' },
  act: { map: 'افتح الخريطة', scanner: 'افحص منتجًا', mushaf: 'افتح المصحف', alarms: 'منبّهات الصلاة', locate: 'استخدم موقعي', alarm: (n) => `فعّل منبّه ${n}` },
  alarmOn: (n, t) => `تم — منبّه ${n} مفعّل ويرنّ ${t}.`, locFail: 'تعذّر تحديد موقعك. يمكنك السماح به من إعدادات المتصفح.',
  also: 'ذو صلة أيضًا', maybe: 'هل تقصد…', read: 'اقرأ بصوت', stop: 'إيقاف القراءة',
}

const de = {
  small: {
    greet: 'Wa alaykum as-salam! Frag mich zu Gebet, Wudu, Fasten oder Halal-Essen — oder nach den heutigen Gebetszeiten und der Qibla.',
    thanks: 'Wa iyyak — gern geschehen. Frag mich jederzeit mehr.',
    who: 'Ich bin Rashed, der Begleiter der App. Ich gebe kurze Antworten nach der Lehre der Gelehrten und verlinke ihre ganzen Worte. Ich kann dir auch Gebetszeiten zeigen, die Qibla finden, Zutaten prüfen und die Karte öffnen.',
    help: 'Frag mich zu Gebet, Wudu, Ghusl, Fasten, Zakat, Hadsch, Halal-Essen und mehr. Ich zeige dir auch die heutigen Gebetszeiten, die Qibla-Richtung, prüfe Zutaten oder E-Nummern, öffne die Karte für Moscheen und Halal-Essen und schalte einen Gebetswecker ein.',
    bye: 'Ma’a as-salama — möge Allah es dir leicht machen.',
  },
  english: 'Diese Antwort gibt es vorerst nur auf Englisch.',
  timesH: 'Gebetszeiten heute', next: (n, t, x) => `Als Nächstes: ${n} um ${t} (in ${x})`, sunrise: 'Sonnenaufgang',
  qiblaH: 'Qibla von deinem Standort', qibla: (d, dir, km) => `${d}° von Norden (${dir}) · ${km} km bis zur Kaaba`, qiblaHint: 'Dreh dich, bis der Kompass deines Handys diese Richtung zeigt.',
  dirs: { N: 'Norden', NE: 'Nordosten', E: 'Osten', SE: 'Südosten', S: 'Süden', SW: 'Südwesten', W: 'Westen', NW: 'Nordwesten' },
  needLoc: { times: 'Teile deinen Standort, dann zeige ich dir die Gebetszeiten vor Ort.', qibla: 'Teile deinen Standort, dann berechne ich die Qibla von dort.' },
  ingrH: 'Das hat die Zutatenprüfung gefunden', status: { haram: 'Nicht halal', doubtful: 'Herkunft prüfen' },
  act: { map: 'Karte öffnen', scanner: 'Produkt scannen', mushaf: 'Koran öffnen', alarms: 'Gebetswecker', locate: 'Meinen Standort nutzen', alarm: (n) => `${n}-Wecker einschalten` },
  alarmOn: (n, t) => `Erledigt — dein ${n}-Wecker ist an und klingelt um ${t}.`, locFail: 'Ich konnte deinen Standort nicht abrufen. Du kannst ihn in den Browsereinstellungen erlauben.',
  also: 'Ebenfalls passend', maybe: 'Meintest du…', read: 'Vorlesen', stop: 'Vorlesen stoppen',
}

const fr = {
  small: {
    greet: 'Wa alaykoum as-salam ! Posez-moi vos questions sur la prière, les ablutions, le jeûne ou la nourriture halal — ou demandez les horaires de prière du jour ou la qibla.',
    thanks: 'Wa iyyak — avec plaisir. Demandez-moi autre chose quand vous voulez.',
    who: 'Je suis Rashed, le guide de l’app. Je donne des réponses courtes d’après l’enseignement des savants et je renvoie à leurs paroles complètes. Je peux aussi afficher vos horaires de prière, trouver la qibla, vérifier des ingrédients et ouvrir la carte.',
    help: 'Posez-moi vos questions sur la prière, les ablutions, le ghousl, le jeûne, la zakat, le hajj, la nourriture halal… Je peux aussi afficher les horaires du jour, donner la direction de la qibla, vérifier un ingrédient ou un code E, ouvrir la carte des mosquées et du halal, et activer un réveil de prière.',
    bye: 'Ma’a as-salama — qu’Allah vous facilite les choses.',
  },
  english: 'Cette réponse est en anglais pour l’instant.',
  timesH: 'Horaires de prière du jour', next: (n, t, x) => `Prochaine : ${n} à ${t} (dans ${x})`, sunrise: 'Lever du soleil',
  qiblaH: 'La qibla depuis votre position', qibla: (d, dir, km) => `${d}° depuis le nord (${dir}) · ${km} km jusqu’à la Kaaba`, qiblaHint: 'Tournez-vous jusqu’à ce que la boussole du téléphone indique cette direction.',
  dirs: { N: 'nord', NE: 'nord-est', E: 'est', SE: 'sud-est', S: 'sud', SW: 'sud-ouest', W: 'ouest', NW: 'nord-ouest' },
  needLoc: { times: 'Partagez votre position et je vous montre les horaires de prière chez vous.', qibla: 'Partagez votre position et je calcule la qibla depuis là où vous êtes.' },
  ingrH: 'Ce que le vérificateur d’ingrédients a trouvé', status: { haram: 'Non halal', doubtful: 'Vérifiez l’origine' },
  act: { map: 'Ouvrir la carte', scanner: 'Scanner un produit', mushaf: 'Ouvrir le Coran', alarms: 'Réveils de prière', locate: 'Utiliser ma position', alarm: (n) => `Activer le réveil de ${n}` },
  alarmOn: (n, t) => `C’est fait — votre réveil de ${n} est activé et sonne à ${t}.`, locFail: 'Impossible d’obtenir votre position. Vous pouvez l’autoriser dans les réglages du navigateur.',
  also: 'À voir aussi', maybe: 'Vouliez-vous dire…', read: 'Lire à voix haute', stop: 'Arrêter la lecture',
}

const es = {
  small: {
    greet: '¡Wa alaykum as-salam! Pregúntame sobre la oración, el wudu, el ayuno o la comida halal, o pídeme los horarios de oración de hoy o la qibla.',
    thanks: 'Wa iyyak, de nada. Pregúntame lo que quieras cuando quieras.',
    who: 'Soy Rashed, el guía de la app. Doy respuestas breves según lo que enseñan los sabios y enlazo sus palabras completas. También puedo mostrar tus horarios de oración, encontrar la qibla, revisar ingredientes y abrir el mapa.',
    help: 'Pregúntame sobre la oración, el wudu, el gusl, el ayuno, el zakat, el hach, la comida halal y más. También muestro los horarios de hoy, la dirección de la qibla, reviso un ingrediente o código E, abro el mapa de mezquitas y comida halal y activo una alarma de oración.',
    bye: 'Ma’a as-salama: que Allah te lo haga fácil.',
  },
  english: 'Por ahora esta respuesta está en inglés.',
  timesH: 'Horarios de oración de hoy', next: (n, t, x) => `Próxima: ${n} a las ${t} (en ${x})`, sunrise: 'Amanecer',
  qiblaH: 'La qibla desde donde estás', qibla: (d, dir, km) => `${d}° desde el norte (${dir}) · ${km} km hasta la Kaaba`, qiblaHint: 'Gira hasta que la brújula del móvil marque esta dirección.',
  dirs: { N: 'norte', NE: 'noreste', E: 'este', SE: 'sureste', S: 'sur', SW: 'suroeste', W: 'oeste', NW: 'noroeste' },
  needLoc: { times: 'Comparte tu ubicación y te muestro los horarios de oración donde estás.', qibla: 'Comparte tu ubicación y calculo la qibla desde donde estás.' },
  ingrH: 'Lo que encontró el revisor de ingredientes', status: { haram: 'No halal', doubtful: 'Revisa el origen' },
  act: { map: 'Abrir el mapa', scanner: 'Escanear un producto', mushaf: 'Abrir el Corán', alarms: 'Alarmas de oración', locate: 'Usar mi ubicación', alarm: (n) => `Activar la alarma de ${n}` },
  alarmOn: (n, t) => `Listo: tu alarma de ${n} está activada y suena a las ${t}.`, locFail: 'No pude obtener tu ubicación. Puedes permitirla en los ajustes del navegador.',
  also: 'También relacionado', maybe: '¿Quisiste decir…?', read: 'Leer en voz alta', stop: 'Dejar de leer',
}

const ja = {
  small: {
    greet: 'ワ・アライクムッサラーム！礼拝、ウドゥー、断食、ハラール食について聞いてください。今日の礼拝時刻やキブラも調べられます。',
    thanks: 'ワ・イッヤーク。どういたしまして。いつでも聞いてください。',
    who: '私はアプリの案内役ラーシドです。学者の教えをもとに短く答え、全文へのリンクを示します。礼拝時刻の表示、キブラの方角、原材料のチェック、地図を開くこともできます。',
    help: '礼拝、ウドゥー、グスル、断食、ザカート、ハッジ、ハラール食などについて聞けます。今日の礼拝時刻、キブラの方角、原材料やE番号のチェック、モスクやハラール食の地図、礼拝アラームの設定もできます。',
    bye: 'マアッサラーマ。アッラーがあなたに容易さを与えますように。',
  },
  english: 'この回答は今のところ英語のみです。',
  timesH: '今日の礼拝時刻', next: (n, t, x) => `次: ${n} ${t}（あと${x}）`, sunrise: '日の出',
  qiblaH: '現在地からのキブラ', qibla: (d, dir, km) => `北から${d}°（${dir}）· カアバまで${km} km`, qiblaHint: 'スマホのコンパスがこの方角を指すように向いてください。',
  dirs: { N: '北', NE: '北東', E: '東', SE: '南東', S: '南', SW: '南西', W: '西', NW: '北西' },
  needLoc: { times: '位置情報を共有すると、現在地の礼拝時刻を表示します。', qibla: '位置情報を共有すると、現在地からのキブラを計算します。' },
  ingrH: '原材料チェックの結果', status: { haram: 'ハラールではありません', doubtful: '由来を確認' },
  act: { map: '地図を開く', scanner: '商品をスキャン', mushaf: 'クルアーンを開く', alarms: '礼拝アラーム', locate: '現在地を使う', alarm: (n) => `${n}のアラームをオン` },
  alarmOn: (n, t) => `${n}のアラームをオンにしました。${t}に鳴ります。`, locFail: '現在地を取得できませんでした。ブラウザの設定で許可できます。',
  also: '関連する質問', maybe: 'もしかして…', read: '読み上げ', stop: '読み上げを止める',
}

export const RASHED_TEXT = { en, ar, de, fr, es, ja }
export const rashedText = (lang) => RASHED_TEXT[lang] || en
