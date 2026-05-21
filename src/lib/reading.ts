/**
 * kuromoji を使った正確な日本語読み変換（漢字 → カタカナ）
 * LLM に頼らず、形態素解析エンジンでローカル処理する
 */
import kuromoji from "kuromoji";

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

let _promise: Promise<Tokenizer> | null = null;

function getTokenizer(): Promise<Tokenizer> {
  if (!_promise) {
    _promise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: "/dict" }).build((err, t) => {
        err ? reject(err) : resolve(t);
      });
    });
  }
  return _promise;
}

/** テキストをカタカナ読みに変換する */
export async function toKatakana(text: string): Promise<string> {
  const tokenizer = await getTokenizer();
  return tokenizer
    .tokenize(text)
    .map(t =>
      t.reading
        ? t.reading
        : t.surface_form.replace(/[ぁ-ゖ]/g, c =>
            String.fromCharCode(c.charCodeAt(0) + 0x60)
          )
    )
    .join("");
}
