const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if (!id) {
  alert("論文IDが指定されていません");
  window.location.href = "index.html";
}

const paperInfo = document.getElementById("paperInfo");
const sectionList = document.getElementById("sectionList");
const paragraphSummaries = document.getElementById("paragraphSummaries");
const summaryText = document.getElementById("summaryText");
const summarizeSelectedBtn = document.getElementById("summarizeSelectedBtn");

// IndexedDBの初期化
let db;
const dbName = "papersDB";
const dbVersion = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            console.error("DBの初期化に失敗しました:", event);
            reject("DBエラー");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("papers")) {
                db.createObjectStore("papers", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", { keyPath: "id" });
            }
        };
    });
};

// 論文データを読み込む
const loadPaper = async (paperId) => {
    try {
        const transaction = db.transaction(["papers", "files"], "readonly");
        const paperStore = transaction.objectStore("papers");
        const fileStore = transaction.objectStore("files");

        const paper = await new Promise((resolve, reject) => {
            const request = paperStore.get(paperId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!paper) {
            throw new Error("論文が見つかりません");
        }

        if (paper.hasFile) {
            const fileData = await new Promise((resolve, reject) => {
                const request = fileStore.get(paperId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            if (fileData) {
                paper.fileData = fileData.fileData;
            }
        }

        return paper;
    } catch (e) {
        console.error('読み込みエラー:', e);
        throw e;
    }
};

// 論文データを保存
const savePaper = async (paper) => {
    try {
        const transaction = db.transaction(["papers", "files"], "readwrite");
        const paperStore = transaction.objectStore("papers");
        const fileStore = transaction.objectStore("files");

        if (paper.fileData) {
            await fileStore.put({
                id: paper.id,
                fileData: paper.fileData
            });
            
            const paperWithoutFile = {...paper};
            delete paperWithoutFile.fileData;
            paperWithoutFile.hasFile = true;
            await paperStore.put(paperWithoutFile);
        } else {
            await paperStore.put(paper);
        }

        return true;
    } catch (e) {
        console.error('保存エラー:', e);
        throw e;
    }
};

// APIエンドポイントの設定
const API_BASE_URL = "https://openai-proxy-server-w980.onrender.com";
const API_ENDPOINTS = {
    summarizeSection: `${API_BASE_URL}/summarize-section`,
    summarizeFull: `${API_BASE_URL}/summarize-full`
};

let paper = null;

// 基本情報の表示
const displayPaperInfo = () => {
    paperInfo.innerHTML = `
        <p><strong>タイトル:</strong> ${paper.title}</p>
        <p><strong>日付:</strong> ${paper.date}</p>
    `;
};

// セクションリストの表示
function displaySectionList() {
    if (!paper.sections || paper.sections.length === 0) {
        sectionList.innerHTML = "<p>セクションが見つかりません</p>";
        summarizeSelectedBtn.disabled = true;
        return;
    }

    sectionList.innerHTML = paper.sections.map((section, index) => `
        <div class="section-item" data-index="${index}">
            <input type="checkbox" id="section${index}" name="section${index}">
            <label for="section${index}">${section.title}</label>
        </div>
    `).join('');

    // チェックボックスの状態変更時の処理
    const checkboxes = sectionList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const sectionItem = checkbox.closest('.section-item');
            if (checkbox.checked) {
                sectionItem.classList.add('selected');
            } else {
                sectionItem.classList.remove('selected');
            }
            
            // 選択されているセクションがあるかどうかでボタンの有効/無効を切り替え
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            summarizeSelectedBtn.disabled = !anyChecked;
        });
    });
}

// 保存された要約の表示
const displaySavedSummaries = () => {
    if (paper.sectionSummaries) {
        // 既存の要約をテキストエリアとして表示
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = paper.sectionSummaries;
        const summaryDivs = Array.from(tempDiv.querySelectorAll('.paragraph-summary'));
        const editableSummaries = summaryDivs.map(div => {
            const title = div.querySelector('h4').textContent;
            const content = div.querySelector('.summary-content').textContent;
            return `<div class="paragraph-summary">
                <h4>${title}</h4>
                <textarea class="summary-textarea">${content}</textarea>
            </div>`;
        }).join('');
        paragraphSummaries.innerHTML = editableSummaries;

        // テキストエリアの変更を監視して自動保存
        const textareas = paragraphSummaries.querySelectorAll('.summary-textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', async () => {
                try {
                    // 現在のすべての要約を収集
                    const currentSummaries = Array.from(paragraphSummaries.querySelectorAll('.paragraph-summary')).map(div => {
                        const title = div.querySelector('h4').textContent;
                        const content = div.querySelector('textarea').value;
                        return `<div class="paragraph-summary">
                            <h4>${title}</h4>
                            <div class="summary-content">${content}</div>
                        </div>`;
                    }).join('');

                    paper.sectionSummaries = currentSummaries;
                    await savePaper(paper);
                } catch (error) {
                    console.error('要約の保存に失敗しました:', error);
                }
            });
        });
    }
    summaryText.value = paper.summary || "";
};

// 📝 選択されたセクションの要約
summarizeSelectedBtn.addEventListener("click", async () => {
    try {
        const selectedSections = Array.from(sectionList.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => {
                const index = parseInt(checkbox.closest('.section-item').dataset.index);
                return paper.sections[index];
            });

        if (selectedSections.length === 0) {
            alert("要約するセクションを選択してください。");
            return;
        }

        summarizeSelectedBtn.disabled = true;
        // 既存の要約結果をDOMパースして管理しやすい形式に変換
        let existingSummaries = new Map();
        if (paper.sectionSummaries) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = paper.sectionSummaries;
            const summaryDivs = tempDiv.querySelectorAll('.paragraph-summary');
            summaryDivs.forEach(div => {
                const title = div.querySelector('h4').textContent.replace('の要約:', '');
                existingSummaries.set(title, div.querySelector('.summary-content').textContent);
            });
        }

        let allSummaries = "";
        paragraphSummaries.innerHTML = "<p>要約を開始します...</p>";

        for (const section of selectedSections) {
            try {
                paragraphSummaries.innerHTML = allSummaries + `<p>${section.title}を要約中...</p>`;

                const res = await fetch(API_ENDPOINTS.summarizeSection, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: section.content })
                });

                const data = await res.json();
                if (data.error) {
                    throw new Error(`${data.error}\n${data.details || ''}`);
                }
                
                const summary = data.reply;
                const newSummaryDiv = `<div class="paragraph-summary">
                    <h4>${section.title}の要約:</h4>
                    <div class="summary-content">${summary}</div>
                </div>`;
                
                // 新しい要約を追加し、既存の要約から現在のセクションを削除
                existingSummaries.delete(section.title);
                allSummaries += newSummaryDiv;
                
                paragraphSummaries.innerHTML = allSummaries;
            } catch (e) {
                console.error(`${section.title}の処理中にエラー:`, e);
                allSummaries += `<p class="error-message">${section.title}の要約中にエラーが発生しました: ${e.message}</p>`;
                paragraphSummaries.innerHTML = allSummaries;
            }
        }

        // 残りの既存の要約を追加
        for (const [title, content] of existingSummaries.entries()) {
            allSummaries += `<div class="paragraph-summary">
                <h4>${title}の要約:</h4>
                <div class="summary-content">${content}</div>
            </div>`;
        }

        paper.sectionSummaries = allSummaries;
        paper.summarized = true;
        await savePaper(paper);

        // 要約結果を表示（編集可能な形式で）
        displaySavedSummaries();
    } catch (e) {
        console.error("要約エラー:", e);
        paragraphSummaries.innerHTML = `<p class="error-message">要約処理中にエラーが発生しました: ${e.message}</p>`;
    } finally {
        summarizeSelectedBtn.disabled = false;
    }
});

// 📚 全体要約
document.getElementById("summarizeAllBtn").addEventListener("click", async () => {
    const summarizeAllBtn = document.getElementById("summarizeAllBtn");
    try {
        if (!paper.sections || paper.sections.length === 0) {
            alert("セクション情報が見つかりません。PDFを再度アップロードしてください。");
            return;
        }

        summarizeAllBtn.disabled = true;
        summaryText.value = "要約を開始します...";

        // セクションの要約を結合して全体要約のベースとして使用
        const sectionSummaries = paper.sections.map(section => {
            const summary = section.summary || section.content;
            return `${section.title}\n${summary}`;
        }).join("\n\n");

        // テキストの長さを制限（約16K文字）
        const maxLength = 16000;
        const truncatedText = sectionSummaries.length > maxLength 
            ? sectionSummaries.slice(0, maxLength) + "..."
            : sectionSummaries;

        const res = await fetch(API_ENDPOINTS.summarizeFull, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                content: truncatedText,
                title: paper.title
            })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `APIエラー: ${res.status}`);
        }

        const data = await res.json();
        if (data.error) {
            throw new Error(`${data.error}\n${data.details || ''}`);
        }
        
        summaryText.value = data.reply;
        paper.summary = summaryText.value;
        paper.summarized = true;
        await savePaper(paper);
    } catch (e) {
        console.error("全体要約エラー:", e);
        summaryText.value = `要約エラー: ${e.message}`;
        alert("要約処理中にエラーが発生しました。時間をおいて再度お試しください。");
    } finally {
        summarizeAllBtn.disabled = false;
    }
});

// 💾 変更を保存して戻る
document.getElementById("saveBtn").addEventListener("click", async () => {
    try {
        await savePaper(paper);
        window.location.href = "index.html";
    } catch (e) {
        console.error("保存エラー:", e);
        alert("変更の保存中にエラーが発生しました。");
    }
});

// 初期化と論文データの読み込み
initDB().then(async () => {
    try {
        paper = await loadPaper(id);
        displayPaperInfo();
        displaySectionList();
        displaySavedSummaries();
    } catch (error) {
        console.error("論文データの読み込みに失敗しました:", error);
        alert("指定された論文が見つかりません");
        window.location.href = "index.html";
    }
}).catch(error => {
    console.error("DBの初期化に失敗しました:", error);
    alert("データベースの初期化に失敗しました。ページを再読み込みしてください。");
});
