window.addEventListener("DOMContentLoaded", () => {
    // PDF.jsのワーカーの設定
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
    }

    // モーダル要素の取得
    const editModal = document.getElementById("editModal");
    const deleteModal = document.getElementById("deleteModal");
    const summaryViewModal = document.getElementById("summaryViewModal");
    const pdfViewModal = document.getElementById("pdfViewModal");
    const editTitle = document.getElementById("editTitle");
    const editDate = document.getElementById("editDate");
    const deleteTitle = document.getElementById("deleteTitle");
    const summaryViewContent = document.getElementById("summaryViewContent");
    const pdfViewer = document.getElementById("pdfViewer");
  
    // 現在編集・削除対象の論文ID
    let currentPaperId = null;
  
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
  
    // 全ての論文データを読み込む
    const loadPapers = async () => {
        try {
            const transaction = db.transaction(["papers", "files"], "readonly");
            const paperStore = transaction.objectStore("papers");
            const fileStore = transaction.objectStore("files");
  
            const papers = await new Promise((resolve, reject) => {
                const request = paperStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
  
            // ファイルデータを読み込む
            for (const paper of papers) {
                if (paper.hasFile) {
                    const fileData = await new Promise((resolve, reject) => {
                        const request = fileStore.get(paper.id);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    });
                    if (fileData) {
                        paper.fileData = fileData.fileData;
                    }
                }
            }
  
            return papers;
        } catch (e) {
            console.error('読み込みエラー:', e);
            return [];
        }
    };

    // 論文を削除
    const deletePaper = async (paperId) => {
        try {
            const transaction = db.transaction(["papers", "files"], "readwrite");
            const paperStore = transaction.objectStore("papers");
            const fileStore = transaction.objectStore("files");

            // ファイルデータの削除
            await fileStore.delete(paperId);
            // 論文データの削除
            await paperStore.delete(paperId);

            return true;
        } catch (e) {
            console.error('削除エラー:', e);
            throw e;
        }
    };
  
    // ソート状態を管理
    let sortDirection = 'desc'; // 初期値を'desc'（降順）に設定

    // ソートボタンのイベントリスナー
    document.getElementById("sortDateBtn").addEventListener("click", async () => {
        const sortBtn = document.getElementById("sortDateBtn");
        
        // ソート方向を切り替え
        if (sortDirection === 'desc') {
            sortDirection = 'asc';
            sortBtn.textContent = '↑ 古い順';
        } else {
            sortDirection = 'desc';
            sortBtn.textContent = '↓ 新しい順';
        }
        
        sortBtn.classList.add('active');
        await updateTable();
    });

    // 📄 テーブルの更新
    const updateTable = async () => {
        const entries = await loadPapers();
        const tbody = document.getElementById("tableBody");
  
        if (entries.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5'>保存された論文はありません。</td></tr>";
            return;
        }

        // ソートが有効な場合は日付でソート
        if (sortDirection !== null) {
            entries.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }
  
        tbody.innerHTML = entries.map(entry => `
            <tr>
                <td class="title-cell">${entry.title}</td>
                <td class="date-cell">${entry.date}</td>
                <td class="status-cell">
                    ${entry.summarized ? `
                        <div class="summary-status">
                            <span class="status-icon">✅</span>
                            <button class="view-btn-small" onclick="handleViewSummary('${entry.id}')">閲覧</button>
                        </div>
                    ` : '❌'}
                </td>
                <td class="file-cell">
                    ${entry.hasFile ? `
                        <button class="file-btn" onclick="handleViewPdf('${entry.id}')">表示</button>
                    ` : '未登録'}
                </td>
                <td class="action-cell">
                    <div class="action-buttons">
                        <a href="detail.html?id=${entry.id}" class="btn detail-btn">要約</a>
                        <button class="edit-btn" onclick="handleEdit('${entry.id}')">編集</button>
                        <button class="delete-btn" onclick="handleDelete('${entry.id}')">削除</button>
                    </div>
                </td>
            </tr>
        `).join('');
    };
  
    // ✏️ 編集モーダルを開く
    window.handleEdit = async (paperId) => {
        const paper = await loadPaper(paperId);
        if (!paper) return;
  
        currentPaperId = paperId;
        editTitle.value = paper.title;
        editDate.value = paper.date;
        editModal.style.display = "block";
    };
  
    // 🗑️ 削除モーダルを開く
    window.handleDelete = async (paperId) => {
        const paper = await loadPaper(paperId);
        if (!paper) return;
  
        currentPaperId = paperId;
        deleteTitle.textContent = paper.title;
        deleteModal.style.display = "block";
    };
  
    // 📖 要約閲覧モーダルを開く
    window.handleViewSummary = async (paperId) => {
        const paper = await loadPaper(paperId);
        if (!paper) return;

        // セクション要約を解析してソート
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = paper.sectionSummaries || '';
        const summaryDivs = Array.from(tempDiv.querySelectorAll('.paragraph-summary'));
        
        // セクション番号でソート
        const sortedSummaryDivs = summaryDivs.sort((a, b) => {
            const titleA = a.querySelector('h4').textContent;
            const titleB = b.querySelector('h4').textContent;
            
            // セクション番号を抽出（例：「2.1」や「3」などの形式に対応）
            const getSecNumber = (title) => {
                const match = title.match(/^(\d+(\.\d+)*)/);
                if (match) {
                    return match[1].split('.').map(num => parseInt(num, 10));
                }
                return [Infinity];
            };

            const numA = getSecNumber(titleA);
            const numB = getSecNumber(titleB);

            // 階層的な番号付けの比較（例：2.1 vs 2.2）
            for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
                const a = numA[i] || 0;
                const b = numB[i] || 0;
                if (a !== b) return a - b;
            }
            return 0;
        });

        const sortedSummaries = sortedSummaryDivs.map(div => {
            const title = div.querySelector('h4').textContent;
            const content = div.querySelector('.summary-content').textContent;
            return `<div class="paragraph-summary">
                <h4>${title}</h4>
                <div class="summary-content">${content}</div>
            </div>`;
        }).join('');

        summaryViewContent.innerHTML = `
            <h3>${paper.title}の要約</h3>
            <div class="summary-sections">
                ${paper.sectionSummaries ? `
                    <h4>セクション要約:</h4>
                    <div class="section-summaries">${sortedSummaries}</div>
                ` : ''}
                ${paper.summary ? `
                    <h4>全体要約:</h4>
                    <div class="full-summary">${paper.summary}</div>
                ` : ''}
            </div>
        `;
        summaryViewModal.style.display = "block";
    };
  
    // 📄 PDFビューアーを開く
    window.handleViewPdf = async (paperId) => {
        const paper = await loadPaper(paperId);
        if (!paper || !paper.fileData) return;

        pdfViewer.src = paper.fileData;
        pdfViewModal.style.display = "block";
    };

    // PDFビューアーを閉じる
    document.getElementById("closePdfViewBtn").addEventListener("click", () => {
        pdfViewModal.style.display = "none";
        pdfViewer.src = "";
    });

    // 編集を保存
    document.getElementById("saveEditBtn").addEventListener("click", async () => {
        const paper = await loadPaper(currentPaperId);
        if (!paper) return;
  
        paper.title = editTitle.value;
        paper.date = editDate.value;

        try {
            await savePaper(paper);
            editModal.style.display = "none";
            await updateTable();
        } catch (error) {
            console.error('保存に失敗しました:', error);
            alert('変更の保存に失敗しました。');
        }
    });

    // 削除を実行
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
        try {
            await deletePaper(currentPaperId);
            deleteModal.style.display = "none";
            await updateTable();
        } catch (error) {
            console.error('削除に失敗しました:', error);
            alert('論文の削除に失敗しました。');
        }
    });

    // モーダルを閉じる
    document.getElementById("cancelEditBtn").addEventListener("click", () => {
        editModal.style.display = "none";
    });

    document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
        deleteModal.style.display = "none";
    });

    document.getElementById("closeSummaryViewBtn").addEventListener("click", () => {
        summaryViewModal.style.display = "none";
    });

    // モーダルの外側をクリックして閉じる
    window.addEventListener("click", (event) => {
        if (event.target === editModal) {
            editModal.style.display = "none";
        }
        if (event.target === deleteModal) {
            deleteModal.style.display = "none";
        }
        if (event.target === summaryViewModal) {
            summaryViewModal.style.display = "none";
        }
        if (event.target === pdfViewModal) {
            pdfViewModal.style.display = "none";
            pdfViewer.src = "";
        }
    });

    // 初期化処理
    initDB().then(async () => {
        try {
            // LocalStorageからIndexedDBへの移行処理
            const existingData = localStorage.getItem("papers");
            if (existingData) {
                const papers = JSON.parse(existingData);
                for (const paper of papers) {
                    await savePaper(paper);
                }
                // 移行が成功したら、LocalStorageのデータを削除
                localStorage.removeItem("papers");
            }
            // 初期表示時にソートボタンの状態を設定
            const sortBtn = document.getElementById("sortDateBtn");
            sortBtn.textContent = '↓';
            sortBtn.classList.add('active');
            await updateTable();
        } catch (error) {
            console.error("データの移行に失敗しました:", error);
        }
    }).catch(error => {
        console.error("DBの初期化に失敗しました:", error);
        alert("データベースの初期化に失敗しました。ページを再読み込みしてください。");
    });
});