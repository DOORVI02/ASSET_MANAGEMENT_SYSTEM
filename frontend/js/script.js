function updateDateTime(){

    const now = new Date();

    document.getElementById("currentDate").innerHTML =
    now.toLocaleDateString("en-IN",{
        day:"2-digit",
        month:"long",
        year:"numeric"
    });

    document.getElementById("currentTime").innerHTML =
    now.toLocaleTimeString("en-IN");

}

updateDateTime();

setInterval(updateDateTime,1000);