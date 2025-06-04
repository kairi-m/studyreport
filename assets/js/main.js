window.addEventListener("DOMContentLoaded", () => {
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
  
    // 📥 localStorage からデータを読み込む
    const loadPapers = () => {
      return JSON.parse(localStorage.getItem("papers") || "[]");
    };
  
    // 💾 データを保存
    const savePapers = (papers) => {
      localStorage.setItem("papers", JSON.stringify(papers));
    };
  
    // 📄 テーブルの更新
    const updateTable = () => {
      const entries = loadPapers();
      const tbody = document.getElementById("tableBody");
  
      if (entries.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5'>保存された論文はありません。</td></tr>";
        return;
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
            ${entry.fileData ? `
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
    window.handleEdit = (paperId) => {
      const papers = loadPapers();
      const paper = papers.find(p => p.id === paperId);
      if (!paper) return;
  
      currentPaperId = paperId;
      editTitle.value = paper.title;
      editDate.value = paper.date;
      editModal.style.display = "block";
    };
  
    // 🗑️ 削除モーダルを開く
    window.handleDelete = (paperId) => {
      const papers = loadPapers();
      const paper = papers.find(p => p.id === paperId);
      if (!paper) return;
  
      currentPaperId = paperId;
      deleteTitle.textContent = paper.title;
      deleteModal.style.display = "block";
    };
  
    // 📖 要約閲覧モーダルを開く
    window.handleViewSummary = (paperId) => {
      const papers = loadPapers();
      const paper = papers.find(p => p.id === paperId);
      if (!paper) return;
  
      summaryViewContent.innerHTML = `
        <h3>${paper.title}の要約</h3>
        <div class="summary-sections">
          ${paper.sectionSummaries ? `
            <h4>セクション要約:</h4>
            <div class="section-summaries">${paper.sectionSummaries}</div>
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
    window.handleViewPdf = (paperId) => {
      const papers = loadPapers();
      const paper = papers.find(p => p.id === paperId);
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
    document.getElementById("saveEditBtn").addEventListener("click", () => {
      const papers = loadPapers();
      const paperIndex = papers.findIndex(p => p.id === currentPaperId);
      if (paperIndex === -1) return;
  
      papers[paperIndex] = {
        ...papers[paperIndex],
        title: editTitle.value,
        date: editDate.value
      };

      savePapers(papers);
      editModal.style.display = "none";
      updateTable();
    });

    // 削除を実行
    document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
      const papers = loadPapers();
      const updatedPapers = papers.filter(p => p.id !== currentPaperId);
      savePapers(updatedPapers);
      deleteModal.style.display = "none";
      updateTable();
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

    // 初期表示
    updateTable();
});