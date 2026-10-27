// 1. IMPORTAÇÕES DO FIREBASE (Usando a versão estável 10.8.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCy9VwC8m6uzl83hECYy14-JeMYkpCnZ94",
  authDomain: "pokedex-c1af3.firebaseapp.com",
  projectId: "pokedex-c1af3",
  storageBucket: "pokedex-c1af3.firebasestorage.app",
  messagingSenderId: "125454256582",
  appId: "1:125454256582:web:06af323d24ae80a0648ac7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Seletores
const pokemonName = document.querySelector('.pokemon__name');
const pokemonNumber = document.querySelector('.pokemon__number');
const pokemonImage = document.querySelector('.pokemon__image');
const infoBox = document.querySelector('.pokemon-info-box');
const pokemonTypes = document.querySelector('.pokemon__types span');
const pokemonDescription = document.querySelector('.pokemon__description span');
const pokemonLocation = document.querySelector('.pokemon__location span');
const evolutionContainer = document.querySelector('.evolution-container');
const buttonEvolution = document.querySelector('.btn-evolution');
const megaContainer = document.querySelector('.mega-container');
const gmaxContainer = document.querySelector('.gmax-container');

const form = document.querySelector('.form');
const input = document.querySelector('.input__search');
const buttonPrev = document.querySelector('.btn-prev');
const buttonNext = document.querySelector('.btn-next');

const btnSaveFavorite = document.querySelector('.btn-save-favorite');
const favoritesList = document.getElementById('favorites-list');

const loginOverlay   = document.getElementById('loginOverlay');
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const userBar        = document.getElementById('userBar');
const userPhoto      = document.getElementById('userPhoto');
const userName       = document.getElementById('userName');
const btnLogout      = document.getElementById('btnLogout');
const favoritesHint  = document.getElementById('favoritesHint');

// Estado
let currentPokemon = { id: 1, name: 'bulbasaur', sprite: '' };
let nextEvolutionName = null;
let currentUser = null;
let basePokemonId = 1;   // guarda a forma base para o botão Reverter

// ============ API ============
const fetchAPI = async (url) => {
  const response = await fetch(url);
  if (response.status === 200) return response.json();
}

const playCry = (cryUrl) => {
  if (cryUrl) {
    const cry = new Audio(cryUrl);
    cry.volume = 0.2;
    cry.play();
  }
}

// ============ DISPLAY ============
const displayPokemonInfo = async (data) => {
  buttonPrev.disabled = false;
  buttonNext.disabled = false;

  const [speciesData, encounterData] = await Promise.all([
    fetchAPI(`https://pokeapi.co/api/v2/pokemon-species/${data.id}`),
    fetchAPI(`https://pokeapi.co/api/v2/pokemon/${data.id}/encounters`)
  ]);

  infoBox.style.display = 'flex';
  pokemonImage.style.display = 'block';
  pokemonName.innerHTML = data.name.replace(/-/g, ' ');
  pokemonNumber.innerHTML = data.id;
  input.value = '';

  const types = data.types.map(typeInfo => typeInfo.type.name);
  pokemonTypes.innerHTML = `Tipo: ${types.join(' | ')}`;
  pokemonLocation.innerHTML = (encounterData && encounterData.length > 0)
    ? `Local: ${encounterData[0].location_area.name.replace(/-/g, ' ')}`
    : 'Local: Não encontrado na natureza.';

  if (speciesData) {
    const flavorTextEntry = speciesData.flavor_text_entries.find(entry => entry.language.name === 'en');
    pokemonDescription.innerHTML = flavorTextEntry
      ? flavorTextEntry.flavor_text.replace(/[\n\f]/g, ' ')
      : 'Descrição não disponível.';

    handleEvolutions(speciesData, data.name);
    handleMegaEvolutions(speciesData);
    handleGigantamax(speciesData);
  }

  const gen5Sprite = data.sprites.versions['generation-v']['black-white'].animated.front_default;
  const animatedSprite = data.sprites.other.showdown.front_default;
  const staticSprite = data.sprites.other['official-artwork'].front_default;

  pokemonImage.src = gen5Sprite || animatedSprite || staticSprite;
  pokemonImage.onerror = () => { pokemonImage.src = staticSprite; };
  pokemonImage.style.transform = '';
  pokemonImage.style.filter = '';

  currentPokemon = {
    id: data.id,
    name: data.name,
    sprite: staticSprite || data.sprites.front_default
  };

  // Guarda o ID da forma base para o Reverter
  basePokemonId = data.id;

  playCry(data.cries.latest);
}

const renderPokemon = async (pokemonIdentifier) => {
  pokemonImage.classList.remove('evolving', 'mega-evolving', 'gigantamaxing');
  pokemonImage.style.transform = '';
  pokemonImage.style.filter = '';

  const isTransforming = pokemonImage.classList.contains('evolving')
                       || pokemonImage.classList.contains('mega-evolving');
  if (!isTransforming) { pokemonImage.style.display = 'none'; }

  infoBox.style.display = 'none';
  pokemonName.innerHTML = 'Loading...';
  pokemonNumber.innerHTML = '';

  const data = await fetchAPI(`https://pokeapi.co/api/v2/pokemon/${pokemonIdentifier.toString().toLowerCase()}`);

  if (data) {
    await displayPokemonInfo(data);
  } else {
    pokemonImage.style.display = 'none';
    pokemonName.innerHTML = 'Não encontrado :c';
  }
}

// ============ EVOLUÇÕES ============
const handleEvolutions = async (speciesData, pokemonName) => {
  nextEvolutionName = null;
  const evolutionChainResponse = await fetchAPI(speciesData.evolution_chain.url);
  let currentStage = evolutionChainResponse.chain;
  while (currentStage && currentStage.species.name !== pokemonName.split('-')[0]) {
    currentStage = currentStage.evolves_to[0];
  }
  if (currentStage && currentStage.evolves_to.length > 0) {
    nextEvolutionName = currentStage.evolves_to[0].species.name;
  }
}

const handleMegaEvolutions = (speciesData) => {
  megaContainer.innerHTML = '';
  const megaVarieties = speciesData.varieties.filter(v => v.pokemon.name.includes('-mega') && !v.is_default);

  if (megaVarieties.length > 0) {
    megaVarieties.forEach(mega => {
      const megaButton = document.createElement('button');
      megaButton.className = 'btn-mega button';
      megaButton.innerText = mega.pokemon.name.split('-').slice(1).join(' ').toUpperCase();
      megaButton.addEventListener('click', () => triggerFormChange(mega.pokemon.name, 'mega-evolving'));
      megaContainer.appendChild(megaButton);
    });
  }
}

const handleGigantamax = (speciesData) => {
  gmaxContainer.innerHTML = '';
  const gmaxVariety = speciesData.varieties.find(v => v.pokemon.name.includes('-gmax'));

  if (gmaxVariety) {
    const gmaxButton = document.createElement('button');
    gmaxButton.className = 'btn-gmax button';
    gmaxButton.innerText = 'Gigantamax';
    gmaxButton.addEventListener('click', () => triggerFormChange(gmaxVariety.pokemon.name, 'gigantamaxing', true));
    gmaxContainer.appendChild(gmaxButton);
  }
}

const triggerFormChange = async (formName, animationClass, isGigantamax = false) => {
  let formSpecificData;
  let animationDuration = (animationClass === 'mega-evolving') ? 1000 : 800;

  if (isGigantamax) {
    animationDuration = 1500;
    formSpecificData = await fetchAPI(`https://pokeapi.co/api/v2/pokemon/${formName}`);
    if (formSpecificData) playCry(formSpecificData.cries.latest);
  } else if (animationClass === 'mega-evolving') {
    formSpecificData = await fetchAPI(`https://pokeapi.co/api/v2/pokemon/${formName}`);
    if (formSpecificData) playCry(formSpecificData.cries.latest);
  }

  pokemonImage.classList.add(animationClass);

  setTimeout(async () => {
    pokemonImage.classList.remove(animationClass);
    if (!formSpecificData) formSpecificData = await fetchAPI(`https://pokeapi.co/api/v2/pokemon/${formName}`);

    if (formSpecificData) {
      evolutionContainer.style.display = 'none';
      megaContainer.style.display = 'none';
      gmaxContainer.style.display = 'none';
      buttonPrev.disabled = true;
      buttonNext.disabled = true;

      pokemonName.innerHTML = formSpecificData.name.replace(/-/g, ' ');
      pokemonNumber.innerHTML = '';
      const types = formSpecificData.types.map(typeInfo => typeInfo.type.name);
      pokemonTypes.innerHTML = `Tipo: ${types.join(' | ')}`;

      // ---- ATUALIZA O SPRITE (Mega E Gigantamax) ----
      const animatedSprite = formSpecificData.sprites.other?.showdown?.front_default;
      const officialArt    = formSpecificData.sprites.other?.['official-artwork']?.front_default;
      const homeSprite     = formSpecificData.sprites.other?.home?.front_default;
      const defaultSprite  = formSpecificData.sprites.front_default;

      const newSprite = animatedSprite || officialArt || homeSprite || defaultSprite;
      if (newSprite) {
        pokemonImage.src = newSprite;
      }

      // Limpa qualquer transform residual antes de decidir o próximo
      pokemonImage.style.transform = '';

      // Se for G-Max, aplica o scale(2) manualmente (a animação já terminou)
      if (isGigantamax) {
        pokemonImage.style.transform = 'translate(-63%, -10%) scale(2)';
      }

      // currentPokemon agora é a forma especial (para salvar como favorito)
      // MAS o basePokemonId continua a ser o ID original
      currentPokemon = {
        id: formSpecificData.id,
        name: formSpecificData.name,
        sprite: officialArt || defaultSprite
      };

      // ---- BOTÃO REVERTER ----
      const revertButton = document.createElement('button');
      revertButton.className = 'btn-revert button';
      revertButton.innerText = 'Reverter';
      revertButton.addEventListener('click', () => {
        // Restaura a UI
        evolutionContainer.style.display = 'block';
        megaContainer.style.display = 'flex';
        gmaxContainer.style.display = 'flex';
        buttonPrev.disabled = false;
        buttonNext.disabled = false;

        // Limpa estilos residuais da animação (G-Max deixa scale(2) inline)
        pokemonImage.style.transform = '';
        pokemonImage.style.filter = '';
        pokemonImage.classList.remove('mega-evolving', 'gigantamaxing', 'evolving');

        // Volta à forma BASE (não à Mega!)
        renderPokemon(basePokemonId);
      });

      megaContainer.innerHTML = '';
      megaContainer.appendChild(revertButton);
      megaContainer.style.display = 'block';
    }
  }, animationDuration);
}

// ============ LISTENERS BASE ============
buttonEvolution.addEventListener('click', () => {
  if (nextEvolutionName) {
    if (pokemonImage.classList.contains('evolving')) return;
    pokemonImage.classList.add('evolving');
    setTimeout(() => {
      pokemonImage.classList.remove('evolving');
      renderPokemon(nextEvolutionName);
    }, 800);
  } else {
    alert('Este Pokémon não possui mais evoluções!');
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderPokemon(input.value);
});

buttonPrev.addEventListener('click', () => {
  if (currentPokemon.id > 1) renderPokemon(currentPokemon.id - 1);
});

buttonNext.addEventListener('click', () => {
  renderPokemon(currentPokemon.id + 1);
});

// ============ AUTENTICAÇÃO ============
btnLoginGoogle.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Não foi possível entrar com Google. Tenta novamente.');
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao sair:', error);
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    loginOverlay.classList.add('hidden');
    userBar.style.display = 'flex';
    userPhoto.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email;
    favoritesHint.textContent = `Favoritos de ${user.displayName || user.email}`;
    loadFavorites();
  } else {
    loginOverlay.classList.remove('hidden');
    userBar.style.display = 'none';
    favoritesList.innerHTML = '<p>Inicia sessão para ver os teus favoritos.</p>';
  }
});

// ============ CRUD ============
btnSaveFavorite.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Inicia sessão com Google para guardar favoritos.');
    return;
  }
  if (!currentPokemon.name) return;

  try {
    await addDoc(collection(db, "favoritos"), {
      userId: currentUser.uid,
      id: currentPokemon.id,
      name: currentPokemon.name,
      sprite: currentPokemon.sprite,
      apelido: ""
    });
    alert(`O ${currentPokemon.name.toUpperCase()} foi adicionado aos teus favoritos!`);
    loadFavorites();
  } catch (error) {
    console.error("Erro ao guardar favorito: ", error);
    alert("Falha ao salvar no banco de dados.");
  }
});

const loadFavorites = async () => {
  if (!currentUser) {
    favoritesList.innerHTML = '<p>Inicia sessão para ver os teus favoritos.</p>';
    return;
  }

  favoritesList.innerHTML = "A carregar os teus Pokémon...";

  try {
    const q = query(
      collection(db, "favoritos"),
      where("userId", "==", currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    favoritesList.innerHTML = "";

    if (querySnapshot.empty) {
      favoritesList.innerHTML = "<p>Ainda não tens favoritos guardados.</p>";
      return;
    }

    querySnapshot.forEach((documento) => {
      const dbId = documento.id;
      const dados = documento.data();

      const card = document.createElement('div');
      card.className = 'favorite-card';

      const nomeFinal = dados.apelido ? `${dados.name} ("${dados.apelido}")` : dados.name;

      card.innerHTML = `
        <div style="display: flex; align-items: center;">
          <img src="${dados.sprite}" alt="${dados.name}" width="50" style="margin-right: 10px;">
          <strong style="text-transform: capitalize;">${nomeFinal}</strong>
        </div>
        <div>
          <button class="btn-crud edit" onclick="window.updateFavorite('${dbId}')">✏️ Apelido</button>
          <button class="btn-crud delete" onclick="window.deleteFavorite('${dbId}')">🗑️ Excluir</button>
        </div>
      `;
      favoritesList.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao ler os dados:", error);
    favoritesList.innerHTML = "<p>Ocorreu um erro ao carregar os dados.</p>";
  }
};

window.updateFavorite = async (dbId) => {
  const novoApelido = prompt("Que apelido gostarias de dar a este Pokémon?");
  if (novoApelido === null) return;

  try {
    const docRef = doc(db, "favoritos", dbId);
    await updateDoc(docRef, { apelido: novoApelido });
    loadFavorites();
  } catch (error) {
    console.error("Erro ao atualizar:", error);
  }
};

window.deleteFavorite = async (dbId) => {
  const confirmacao = confirm("Tens a certeza que queres remover este Pokémon dos favoritos?");
  if (!confirmacao) return;

  try {
    const docRef = doc(db, "favoritos", dbId);
    await deleteDoc(docRef);
    loadFavorites();
  } catch (error) {
    console.error("Erro ao deletar:", error);
  }
};

// Inicia
renderPokemon(currentPokemon.id);