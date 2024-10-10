//Javascript for the patient list table//

async function loadPatients() {
  try {
      const response = await fetch('/get-patients');
      const patients = await response.json();

      const tbody = document.querySelector('#patientTable tbody');
      patients.forEach(patient => {
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${formatValue(patient.patientID)}</td>
              <td>${formatValue(patient.lastName)}</td>
              <td>${formatValue(patient.firstName)}</td>
              <td>${formatValue(patient.middleName)}</td>
              <td>${formatValue(patient.title)}</td>
              <td>${formatDate(patient.dateOfBirth)}</td>
              <td>${formatValue(patient.gender)}</td>
              <td>${formatValue(patient.address1)}</td>
              <td>${formatValue(patient.address2)}</td>
              <td>${formatValue(patient.addressCity)}</td>
              <td>${formatValue(patient.addressState)}</td>
              <td>${formatValue(patient.addressPostCode)}</td>
              <td>${formatValue(patient.addressCountry)}</td>
              <td>${formatValue(patient.phoneNumber)}</td>
          `;
          tbody.appendChild(row);
      });
  } catch (error) {
      console.error('Error loading patients:', error);
  }
}

function formatValue(value) {
  return value === null ? '' : value;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

loadPatients();

//JavaScript for the Order Form//

async function loadProfiles() {
  try {
      const response = await fetch('/get-profiles'); // Fetch profiles from the server
      const profiles = await response.json();

      const profileSelect = document.getElementById('profileRequested');
      profiles.forEach(profile => {
          const optionElement = document.createElement('option');
          optionElement.value = profile.id; // Use ID as the value
          optionElement.textContent = `${profile.profilename}`; // Display 
          profileSelect.appendChild(optionElement);
      });
  } catch (error) {
      console.error('Error loading profiles:', error);
  }
}

loadProfiles();

//Javascript for the New Patient Form//

document.getElementById('patientForm').addEventListener('submit', function(event) {
  const inputs = this.querySelectorAll('input[required], select[required]');
  inputs.forEach(input => {
      if (!input.value) {
          input.classList.add('invalid');
      } else {
          input.classList.remove('invalid');
      }
  });
});