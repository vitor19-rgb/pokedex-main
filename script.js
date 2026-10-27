// 1. IMPORTAÇÕES DO FIREBASE (Usando a versão estável 10.8.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 2. CONFIGURAÇÃO DO FIREBASE (Com as tuas chaves)
const firebaseConfig = {
  apiKey: "AIzaSyCy9VwC8m6uzl83hECYy14-JeMYkpCnZ94",
  authDomain: "pokedex-c1af3.firebaseapp.com",
  projectId: "pokedex-c1af3",
  storageBucket: "pokedex-c1af3.firebasestorage.app",
  messagingSenderId: "125454256582",
  appId: "1:125454256582:web:06af323d24ae80a0648ac7"
};

// Inicializa a aplicação, o banco de dados (Firestore) e a autenticação
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Seletores para os elementos HTML originais
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

// Seletores para os elementos do Firebase (CRUD)
const btnSaveFavorite = document.querySelector('.btn-save-favorite');
const favoritesList = document.getElementById('favorites-list');

// Seletores da tela de login
const loginOverlay   = document.getElementById('loginOverlay');
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const userBar        = document.getElementById('userBar');
const userPhoto      = document.getElementById('userPhoto');
const userName       = document.getElementById('userName');
const btnLogout      = document.getElementById('btnLogout');
const favoritesHint  = document.getElementById('favoritesHint');

// Variável atualizada para guardar a imagem do Pokémon para o banco de dados
let currentPokemon = { id: 1, name: 'bulbasaur', sprite: '' };
let nextEvolutionName = null;

// Usuário logado atual (null = deslogado)
let currentUser = null;

// Função genérica para buscar da API
const fetchAPI = async (url) => {
  const response = await fetch(url);
  if (response.status === 200) return response.json();
}

// Função para tocar o som do Pokémon
const playCry = (cryUrl) => {
  if (cryUrl) {
    const cry = new Audio(cryUrl);
    cry.volume = 0.2;
    cry.play();
  }
}

// Função para exibir as informações do Pokémon
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
  pokemonLocation.innerHTML = (encounterData && encounterData.length > 0) ? `Local: ${encounterData[0].location_area.name.replace(/-/g, ' ')}` : 'Local: Não encontrado na natureza.';

  if (speciesData) {
    const flavorTextEntry = speciesData.flavor_text_entries.find(entry => entry.language.name === 'en');
    pokemonDescription.innerHTML = flavorTextEntry ? flavorTextEntry.flavor_text.replace(/[\n\f]/g, ' ') : 'Descrição não disponível.';
    
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

  // Atualiza o objeto currentPokemon com a imagem para guardarmos no Firebase
  currentPokemon = { 
    id: data.id, 
    name: data.name, 
    sprite: staticSprite || data.sprites.front_default 
  };

  playCry(data.cries.latest);
}

// Função para renderizar o Pokémon
const renderPokemon = async (pokemonIdentifier) => {
  pokemonImage.classList.remove('evolving', 'mega-evolving', 'gigantamaxing'); 
  pokemonImage.style.transform = '';

  const isTransforming = pokemonImage.classList.contains('evolving') || pokemonImage.classList.contains('mega-evolving');
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

// Funções de formas especiais (Mantidas iguais ao teu código)
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

      if (!isGigantamax) {
        const animatedSprite = formSpecificData.sprites.other.showdown.front_default;
        const staticSprite = formSpecificData.sprites.other['official-artwork'].front_default;
        pokemonImage.src = animatedSprite || staticSprite;
      }
      
      // Atualiza o currentPokemon para permitir guardar a Mega/GMax também
      currentPokemon = {
        id: formSpecificData.id,
        name: formSpecificData.name,
        sprite: formSpecificData.sprites.other['official-artwork'].front_default || formSpecificData.sprites.front_default
      };

      const revertButton = document.createElement('button');
      revertButton.className = 'btn-revert button';
      revertButton.innerText = 'Reverter';
      revertButton.addEventListener('click', () => {
        evolutionContainer.style.display = 'block';
        megaContainer.style.display = 'flex';
        gmaxContainer.style.display = 'flex';
        renderPokemon(currentPokemon.id); // Volta à forma normal
      });
      
      megaContainer.innerHTML = '';
      megaContainer.appendChild(revertButton);
      megaContainer.style.display = 'block';
    }
  }, animationDuration);
}

// Event Listeners base
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

// ==========================================
// AUTENTICAÇÃO (GOOGLE)
// ==========================================

// Login com Google
btnLoginGoogle.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Não foi possível entrar com Google. Tenta novamente.');
  }
});

// Logout
btnLogout.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao sair:', error);
  }
});

// Observa o estado de autenticação
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    // Logado: esconde overlay, mostra barra
    loginOverlay.classList.add('hidden');
    userBar.style.display = 'flex';
    userPhoto.src = user.photoURL || '';
    userName.textContent = user.displayName || user.email;
    favoritesHint.textContent = `Favoritos de ${user.displayName || user.email}`;
    loadFavorites(); // carrega favoritos do usuário
  } else {
    // Deslogado: mostra overlay, esconde barra
    loginOverlay.classList.remove('hidden');
    userBar.style.display = 'none';
    favoritesList.innerHTML = '<p>Inicia sessão para ver os teus favoritos.</p>';
  }
});

// ==========================================
// FUNÇÕES DE CRUD (FIREBASE) - POR USUÁRIO
// ==========================================

// C - CREATE (Cadastrar Novo Favorito)
btnSaveFavorite.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Inicia sessão com Google para guardar favoritos.');
    return;
  }
  if (!currentPokemon.name) return; // Segurança

  try {
    await addDoc(collection(db, "favoritos"), {
      userId: currentUser.uid, // vincula ao usuário
      id: currentPokemon.id,
      name: currentPokemon.name,
      sprite: currentPokemon.sprite,
      apelido: "" // Espaço reservado para atualizar o apelido depois
    });
    alert(`O ${currentPokemon.name.toUpperCase()} foi adicionado aos teus favoritos!`);
    loadFavorites(); // Atualiza a lista na tela
  } catch (error) {
    console.error("Erro ao guardar favorito: ", error);
    alert("Falha ao salvar no banco de dados.");
  }
});

// R - READ (Consultar e Listar os Favoritos do usuário logado)
const loadFavorites = async () => {
  if (!currentUser) {
    favoritesList.innerHTML = '<p>Inicia sessão para ver os teus favoritos.</p>';
    return;
  }

  favoritesList.innerHTML = "A carregar os teus Pokémon...";
  
  try {
    // Filtra apenas os favoritos do usuário logado
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
      const dbId = documento.id; // O ID único que o Firestore cria
      const dados = documento.data(); // Os dados que enviámos
      
      const card = document.createElement('div');
      card.className = 'favorite-card';
      
      // Se ele tiver apelido, mostra-o, se não mostra o nome original
      const nomeFinal = dados.apelido ? `${dados.name} ("${dados.apelido}")` : dados.name;

      // Criamos a estrutura visual de cada favorito
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

// U - UPDATE (Atualizar Apelido)
window.updateFavorite = async (dbId) => {
  const novoApelido = prompt("Que apelido gostarias de dar a este Pokémon?");
  
  if (novoApelido === null) return; // Se o utilizador clicar em 'Cancelar'
  
  try {
    const docRef = doc(db, "favoritos", dbId);
    await updateDoc(docRef, { apelido: novoApelido });
    loadFavorites(); // Atualizamos a lista para mostrar a alteração
  } catch (error) {
    console.error("Erro ao atualizar:", error);
  }
};

// D - DELETE (Excluir do banco)
window.deleteFavorite = async (dbId) => {
  const confirmacao = confirm("Tens a certeza que queres remover este Pokémon dos favoritos?");
  if (!confirmacao) return;

  try {
    const docRef = doc(db, "favoritos", dbId);
    await deleteDoc(docRef);
    loadFavorites(); // Atualizamos a lista após a exclusão
  } catch (error) {
    console.error("Erro ao deletar:", error);
  }
};

// Inicia a Pokédex renderizando o Pokémon inicial
// (O carregamento dos favoritos é feito automaticamente pelo onAuthStateChanged)
renderPokemon(currentPokemon.id);