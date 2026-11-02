/* A small vocabulary of everyday food words. It is NOT a classification list: it only answers
   "does this look like an ingredient list at all?", so gibberish or a nutrition table cannot be called clean.
   Words that are risky are handled by the rules in data.js, not here. */
import { normalizeWord } from './normalize.js'

const EN = `sugar salt flour wheat rice corn maize potato potatoes tomato tomatoes onion garlic oil palm sunflower soy soya soybean
milk cream butter cheese yoghurt yogurt whey egg eggs water yeast spice spices pepper paprika vinegar mustard cocoa chocolate
vanilla vanillin flavour flavours flavor flavors flavouring flavoring colour colours color colors colouring acid citric ascorbic lactic malic
phosphoric lecithin starch syrup glucose fructose dextrose maltodextrin honey fruit fruits juice apple orange lemon grape coffee tea
nut nuts peanut peanuts almond almonds hazelnut sesame seed seeds oat oats barley malt bean beans pea peas lentil lentils chickpea
chickpeas vegetable vegetables carrot beef chicken lamb mutton turkey veal duck meat fish tuna salmon anchovies anchovy prawn prawns
shrimp seaweed pork ham bacon lard fat fats shortening margarine tallow gelatin gelatine rennet enzyme enzymes lipase emulsifier
emulsifiers stabiliser stabilizer preservative preservatives antioxidant thickener acidity regulator raising agent agents baking powder
sodium calcium potassium magnesium carbonate bicarbonate phosphate lactose protein fibre fiber vitamin vitamins mineral minerals wax
shellac glaze carmine cochineal glycerin glycerine glycerol wine beer rum vodka whisky whiskey alcohol ethanol extract powder
concentrate caramel sweetener aspartame sorbate benzoate nitrite nitrate monoglycerides diglycerides cultures culture bacteria casing
collagen bone blood pectin agar carrageenan guar xanthan gum cellulose mozzarella parmesan pasta noodles bread biscuit wafer cereal
sauce paste puree ketchup soup broth stock mirin sake msg monosodium glutamate inosinate guanylate rosemary basil parsley thyme
cumin chilli chili curry ginger cinnamon cardamom saffron turmeric coriander olive olives coconut caffeine carbon dioxide cocoa
rusk breadcrumbs semolina dextrin lecithins mono sheep skimmed pasteurised pasteurized whole powder granules flakes dried
glucose-fructose invert molasses treacle liquorice licorice mint menthol sulphite sulphites sulfite sulfites nutmeg clove cloves
sesame tahini hummus falafel chickpeas parsley bechamel lasagne pizza pepperoni sausage frankfurter filling topping coating`.split(/\s+/)

const AR = `سكر ملح دقيق قمح ارز ذره بطاطس طماطم بصل ثوم زيت نخيل دوار صويا حليب قشطه كريمه زبده جبن جبنه لبن زبادي بيض ماء خميره
بهارات فلفل خل خردل كاكاو شوكولاته فانيليا فانيلا نكهه نكهات لون الوان ملون حمض ستريك ليسيثين نشا شراب جلوكوز فركتوز عسل فاكهه عصير
تفاح برتقال ليمون عنب قهوه شاي مكسرات فول سوداني لوز بندق سمسم بذور شوفان شعير حمص عدس خضروات جزر لحم بقر دجاج غنم ضان سمك
تونه خنزير جيلاتين جلاتين منفحه انفحه انزيم انزيمات مستحلب مثبت حافظه كالسيوم صوديوم بوتاسيوم لاكتوز بروتين فيتامين شمع كحول نبيذ
بيره خمر مستخلص مسحوق كراميل محلي دهن دهون شحم سمن مارجرين خمائر ملح مضافات مواد طبيعيه طبيعي صناعيه`.split(/\s+/)

const FR_DE_ES = `sucre farine sel huile lait oeuf oeufs eau levure gélatine gelatine porc graisse beurre fromage crème
zucker mehl salz wasser milch ei eier öl palmöl weizenmehl butter käse hefe gelatine schweinefett schweinefleisch
azúcar harina sal aceite leche huevo huevos agua levadura manteca cerdo mantequilla queso`.split(/\s+/)

const WORDS = new Set([...EN, ...AR, ...FR_DE_ES].map(normalizeWord))
// longer stems let German-style compounds ("weizenmehl", "sonnenblumenöl") count as known
const STEMS = [...WORDS].filter((w) => w.length >= 4 && /^[a-zäöüß]+$/.test(w))

export function isKnownWord(token) {
  const w = normalizeWord(token).replace(/[^\p{L}\p{N}-]/gu, '')
  if (!w) return false
  if (WORDS.has(w) || WORDS.has(w.replace(/s$/, '')) || WORDS.has(w.replace(/-/g, ''))) return true
  return w.length >= 6 && STEMS.some((s) => w.includes(s))
}
