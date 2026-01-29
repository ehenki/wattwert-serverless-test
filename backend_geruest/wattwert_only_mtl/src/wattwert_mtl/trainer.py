import os
from datetime import datetime
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.tensorboard import SummaryWriter
from torch.cuda.amp import GradScaler, autocast
from tqdm import tqdm

def train_model(model, train_loader, val_loader, config, device):
    lr = config['training']['learning_rate']
    weight_decay = config['training']['weight_decay']
    num_epochs = config['training']['num_epochs']
    aux_weight = config['training']['aux_weight']
    log_dir_base = config['output']['log_dir_base']

    model = model.to(device)
    criterion = nn.CrossEntropyLoss(ignore_index=255)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scaler = GradScaler()
    
    log_dir = os.path.join(log_dir_base, datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))
    writer = SummaryWriter(log_dir)

    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        loop = tqdm(train_loader, desc=f"Epoch [{epoch+1}/{num_epochs}]")

        for images, masks, task_indices in loop:
            images, masks, task_indices = images.to(device), masks.to(device), task_indices.to(device)
            optimizer.zero_grad()

            with autocast():
                element_output, material_output, aux_element_output, aux_material_output = model(images, task_indices)
                loss_element, loss_material = 0, 0
                
                if element_output is not None:
                    loss_element_main = criterion(element_output, masks[task_indices == 0].long())
                    loss_element_aux = criterion(aux_element_output, masks[task_indices == 0].long())
                    loss_element = loss_element_main + aux_weight * loss_element_aux

                if material_output is not None:
                    loss_material_main = criterion(material_output, masks[task_indices == 1].long())
                    loss_material_aux = criterion(aux_material_output, masks[task_indices == 1].long())
                    loss_material = loss_material_main + aux_weight * loss_material_aux
                
                total_loss = loss_element + loss_material

            scaler.scale(total_loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running_loss += total_loss.item()
            loop.set_postfix(loss=total_loss.item())

        avg_train_loss = running_loss / len(train_loader)
        writer.add_scalar("Loss/Train", avg_train_loss, epoch)
        print(f"Epoch {epoch+1} complete. Train Loss: {avg_train_loss:.4f}")

        # Validation phase
        if val_loader:
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for images, masks, task_indices in val_loader:
                    # ... validation loss calculation ...
                    pass # Simplified for brevity
            # avg_val_loss = val_loss / len(val_loader)
            # writer.add_scalar("Loss/Validation", avg_val_loss, epoch)
            # print(f"Validation Loss: {avg_val_loss:.4f}")

    writer.close()
    return model