function normalizeImportedDate(value) {
    if (!value) return new Date().toISOString().split('T')[0];

    if (value instanceof Date && !isNaN(value)) {
        return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number') {
        // Excel stores dates as serial numbers starting from 1899-12-30.
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const parsed = new Date(excelEpoch.getTime() + value * 86400000);
        return parsed.toISOString().split('T')[0];
    }

    const raw = String(value).trim();
    if (!raw) return new Date().toISOString().split('T')[0];

    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        const [, yyyy, mm, dd] = isoMatch;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
        const [, dd, mm, yyyy] = slashMatch;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }

    const parsed = new Date(raw);
    if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];

    return new Date().toISOString().split('T')[0];
}

window.exportToCSV = function() {
    if (jobs.length === 0) {
        alert("No data to export!");
        return;
    }
    const headers = [
        "ID", "Title", "Company", "Location", "Platform", "Date Applied", 
        "Status", "Priority", "Deadline", "Follow Up", "Salary", "URL", 
        "Desc Summary", "CV Version", "Interview Notes", "Reminder Notes", "General Notes"
    ];
    
    const rows = jobs.map(job => [
        job.id, 
        `"${(job.title || '').replace(/"/g, '""')}"`, 
        `"${(job.company || '').replace(/"/g, '""')}"`, 
        `"${(job.location || '').replace(/"/g, '""')}"`,
        `"${(job.platform || '').replace(/"/g, '""')}"`,
        job.date,
        job.status,
        job.priority || 'Medium',
        job.deadline || '',
        job.followUp || '',
        `"${(job.salary || '').replace(/"/g, '""')}"`,
        job.url || '',
        `"${(job.descSummary || '').replace(/"/g, '""')}"`,
        `"${(job.cvVersion || '').replace(/"/g, '""')}"`,
        `"${(job.interviewNotes || '').replace(/"/g, '""')}"`,
        `"${(job.reminderNotes || '').replace(/"/g, '""')}"`,
        `"${(job.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lamara_jobs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportToExcel = function() {
    if (jobs.length === 0) {
        alert("No data to export!");
        return;
    }
    const headers = [
        "ID", "Title", "Company", "Location", "Platform", "Date Applied", 
        "Status", "Priority", "Deadline", "Follow Up", "Salary", "URL", 
        "Desc Summary", "CV Version", "Interview Notes", "Reminder Notes", "General Notes"
    ];
    
    const rows = jobs.map(job => [
        job.id, 
        job.title || '', 
        job.company || '', 
        job.location || '',
        job.platform || '',
        job.date,
        job.status,
        job.priority || 'Medium',
        job.deadline || '',
        job.followUp || '',
        job.salary || '',
        job.url || '',
        job.descSummary || '',
        job.cvVersion || '',
        job.interviewNotes || '',
        job.reminderNotes || '',
        job.notes || ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");
    
    // Download file
    XLSX.writeFile(workbook, "career_tracker_export.xlsx");
};

window.importFromCSV = function(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        // Basic CSV parsing
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
            alert("CSV is empty or invalid.");
            return;
        }
        
        let importedCount = 0;
        // Simple regex to split by comma outside quotes
        const splitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        // Skip header line (index 0)
        for (let i = 1; i < lines.length; i++) {
            const rawCols = lines[i].split(splitRegex).map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            
            // Map back to object
            if (rawCols.length < 7) continue; // basic validation
            
            const appliedDate = normalizeImportedDate(rawCols[5]);
            const importedStatus = rawCols[6] || 'applied';

            const newJob = {
                id: rawCols[0] || Date.now().toString() + i,
                title: rawCols[1] || '',
                company: rawCols[2] || '',
                location: rawCols[3] || '',
                platform: rawCols[4] || '',
                date: appliedDate,
                status: importedStatus,
                priority: rawCols[7] || 'Medium',
                deadline: rawCols[8] || '',
                followUp: rawCols[9] || '',
                salary: rawCols[10] || '',
                url: rawCols[11] || '',
                descSummary: rawCols[12] || '',
                cvVersion: rawCols[13] || '',
                interviewNotes: rawCols[14] || '',
                reminderNotes: rawCols[15] || '',
                notes: rawCols[16] || '',
                hasCvFile: false,
                statusHistory: [{
                    status: importedStatus,
                    date: appliedDate
                }]
            };
            
            // Avoid duplicate IDs
            if (!jobs.find(j => j.id === newJob.id)) {
                jobs.push(newJob);
                importedCount++;
            }
        }
        
        if (importedCount > 0) {
            saveToLocalStorage();
            renderList();
            if (remoteReady && currentUser) {
                try {
                    await saveAllJobsToSupabase();
                } catch (err) {
                    console.error('Failed to sync imported jobs:', err);
                    alert('Imported locally, but cloud sync failed: ' + (err.message || err.error_description || JSON.stringify(err)));
                }
            }
            alert(`Successfully imported ${importedCount} jobs!`);
        } else {
            alert("No new jobs imported. They might be duplicates.");
        }
    };
    reader.readAsText(file);
};

window.importFromExcel = function(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            if (rows.length <= 1) {
                alert("Excel file is empty or invalid.");
                return;
            }
            
            let importedCount = 0;
            // Skip header line (index 0)
            for (let i = 1; i < rows.length; i++) {
                const rawCols = rows[i];
                if (!rawCols || rawCols.length === 0) continue; // skip empty rows
                
                // Map back to object
                const appliedDate = normalizeImportedDate(rawCols[5]);
                const importedStatus = String(rawCols[6] || 'applied');

                const newJob = {
                    id: String(rawCols[0] || Date.now().toString() + i),
                    title: String(rawCols[1] || ''),
                    company: String(rawCols[2] || ''),
                    location: String(rawCols[3] || ''),
                    platform: String(rawCols[4] || ''),
                    date: appliedDate,
                    status: importedStatus,
                    priority: String(rawCols[7] || 'Medium'),
                    deadline: String(rawCols[8] || ''),
                    followUp: String(rawCols[9] || ''),
                    salary: String(rawCols[10] || ''),
                    url: String(rawCols[11] || ''),
                    descSummary: String(rawCols[12] || ''),
                    cvVersion: String(rawCols[13] || ''),
                    interviewNotes: String(rawCols[14] || ''),
                    reminderNotes: String(rawCols[15] || ''),
                    notes: String(rawCols[16] || ''),
                    hasCvFile: false,
                    statusHistory: [{status: importedStatus, date: appliedDate}]
                };
                
                // Check if already exists
                const existingIndex = jobs.findIndex(j => j.id === newJob.id);
                if (existingIndex >= 0) {
                    jobs[existingIndex] = newJob;
                } else {
                    jobs.push(newJob);
                }
                importedCount++;
            }
            
            saveToLocalStorage();
            renderList();
            
            if (remoteReady && currentUser) {
                try {
                    await saveAllJobsToSupabase();
                } catch (err) {
                    console.error('Failed to sync imported jobs:', err);
                }
            }
            
            alert(`Successfully imported/updated ${importedCount} applications from Excel!`);
        } catch (err) {
            console.error(err);
            alert("Error parsing Excel file: " + err.message + "\nStack: " + err.stack);
        }
    };
    reader.readAsArrayBuffer(file);
};
