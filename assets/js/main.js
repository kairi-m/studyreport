window.addEventListener("DOMContentLoaded", () => {
    // モーダル要素の取得
    const editModal = document.getElementById("editModal");
    const deleteModal = document.getElementById("deleteModal");
    const editTitle = document.getElementById("editTitle");
    const editDate = document.getElementById("editDate");
    const editSummary = document.getElementById("editSummary");
    const deleteTitle = document.getElementById("deleteTitle");
  
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
        tbody.innerHTML = "<tr><td colspan='4'>保存された論文はありません。</td></tr>";
        return;
      }
  
      tbody.innerHTML = entries.map(entry => `
        <tr>
          <td class="title-cell">${entry.title}</td>
          <td class="date-cell">${entry.date}</td>
          <td class="status-cell">${entry.summarized ? "✅" : "❌"}</td>
          <td class="action-cell">
            <div class="action-buttons">
              <a href="detail.html?id=${entry.id}" class="btn detail-btn">詳細</a>
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
      editSummary.value = paper.summary || "";
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
  
    // 編集を保存
    document.getElementById("saveEditBtn").addEventListener("click", () => {
      const papers = loadPapers();
      const paperIndex = papers.findIndex(p => p.id === currentPaperId);
      if (paperIndex === -1) return;
  
      papers[paperIndex] = {
        ...papers[paperIndex],
        title: editTitle.value,
        date: editDate.value,
        summary: editSummary.value,
        summarized: editSummary.value.trim() !== ""
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
  
    // モーダルの外側をクリックして閉じる
    window.addEventListener("click", (event) => {
      if (event.target === editModal) {
        editModal.style.display = "none";
      }
      if (event.target === deleteModal) {
        deleteModal.style.display = "none";
      }
    });
  
    // 初期表示
    updateTable();
  });
  